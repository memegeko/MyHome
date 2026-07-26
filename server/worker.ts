import { createBlankDocument } from "../src/defaults";
import type { SiteDocument } from "../src/types";

interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
}

type UploadKind = "image" | "audio";
type UploadPart = { partNumber: number; etag: string };

const sessionCookieName = "myhome_session";
const sessionDays = 14;
const passwordIterations = 210_000;
const uploadChunkBytes = 1024 * 1024;

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const audioTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
]);

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS myhome_owner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS myhome_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS myhome_sessions_expiry
    ON myhome_sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS myhome_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    document TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS myhome_assets (
    id TEXT PRIMARY KEY,
    object_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    kind TEXT NOT NULL,
    credit TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";
}

function json(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function securityHeaders(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("x-content-type-options", "nosniff");
  next.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  next.headers.set("x-frame-options", "DENY");
  next.headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
    ].join("; "),
  );
  return next;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function ensureSchema(database: D1Database) {
  await database.batch(
    schemaStatements.map((statement) => database.prepare(statement)),
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(digest));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
  secret: string,
) {
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}\u0000${secret}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltCopy.buffer,
      iterations,
    },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |=
      (leftBytes[index] || 0) ^
      (rightBytes[index] || 0);
  }
  return mismatch === 0;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

function sessionCookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function createSession(request: Request, env: Env) {
  const token = randomToken();
  const tokenHash = await sha256(`${token}\u0000${env.SESSION_SECRET}`);
  const expiresAt = new Date(
    Date.now() + sessionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  await env.DB.prepare(
    "INSERT INTO myhome_sessions (token_hash, expires_at) VALUES (?, ?)",
  )
    .bind(tokenHash, expiresAt)
    .run();
  return {
    token,
    cookie: sessionCookie(
      request,
      token,
      sessionDays * 24 * 60 * 60,
    ),
  };
}

async function authenticate(request: Request, env: Env) {
  const token = cookieValue(request, sessionCookieName);
  if (!token || !env.SESSION_SECRET) return false;
  const tokenHash = await sha256(`${token}\u0000${env.SESSION_SECRET}`);
  const row = await env.DB.prepare(
    "SELECT token_hash FROM myhome_sessions WHERE token_hash = ? AND expires_at > ?",
  )
    .bind(tokenHash, new Date().toISOString())
    .first();
  return Boolean(row);
}

function isSiteDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<SiteDocument>;
  if (
    document.formatVersion !== 1 ||
    typeof document.configured !== "boolean" ||
    typeof document.siteTitle !== "string" ||
    !document.profile ||
    !Array.isArray(document.pages) ||
    !Array.isArray(document.blocks) ||
    !Array.isArray(document.socials) ||
    !document.appearance
  ) {
    return false;
  }
  const serialized = JSON.stringify(document);
  return (
    new TextEncoder().encode(serialized).byteLength <= 2 * 1024 * 1024 &&
    !serialized.toLowerCase().includes("javascript:")
  );
}

function extensionFor(type: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
  };
  return extensions[type] || "bin";
}

function maxBytesFor(kind: UploadKind) {
  return kind === "image" ? 10 * 1024 * 1024 : 18 * 1024 * 1024;
}

function validUploadType(kind: UploadKind, mimeType: string) {
  return kind === "image" ? imageTypes.has(mimeType) : audioTypes.has(mimeType);
}

function readUploadDescriptor(body: Record<string, unknown>) {
  const kind = cleanText(body.kind, 20) as UploadKind;
  const name = cleanText(body.name, 180);
  const mimeType = cleanText(body.mimeType, 80).toLowerCase();
  const size = Number(body.size);
  const credit =
    cleanText(body.credit, 300) || "Credit information pending";
  if (kind !== "image" && kind !== "audio") {
    return { error: "Upload type must be image or audio.", status: 400 } as const;
  }
  if (!name || !validUploadType(kind, mimeType)) {
    return { error: "That file type is not supported.", status: 415 } as const;
  }
  if (!Number.isInteger(size) || size <= 0 || size > maxBytesFor(kind)) {
    return {
      error: `${kind === "image" ? "Images" : "Audio"} must be smaller than ${maxBytesFor(kind) / 1024 / 1024} MB.`,
      status: 413,
    } as const;
  }
  return { kind, name, mimeType, size, credit } as const;
}

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function idFromObjectKey(objectKey: string) {
  return /^(?:image|audio)\/([0-9a-f-]{36})\.(?:jpg|png|webp|gif|mp3|wav|ogg|m4a)$/i.exec(
    objectKey,
  )?.[1] || "";
}

function stagingPrefix(id: string, uploadId: string) {
  return `_upload-staging/${id}/${uploadId}/`;
}

function stagingKey(id: string, uploadId: string, partNumber: number) {
  return `${stagingPrefix(id, uploadId)}${partNumber}`;
}

async function deleteStaging(
  bucket: R2Bucket,
  id: string,
  uploadId: string,
) {
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({
      prefix: stagingPrefix(id, uploadId),
      cursor,
    });
    if (listed.objects.length) {
      await bucket.delete(listed.objects.map((object) => object.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function handleSite(request: Request, env: Env) {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT document FROM myhome_content WHERE id = 1",
    ).first<{ document: string }>();
    if (!row) {
      return json({ document: createBlankDocument(), setupRequired: true });
    }
    try {
      const document = JSON.parse(row.document) as unknown;
      return isSiteDocument(document)
        ? json({ document, setupRequired: false })
        : json({ error: "Stored site content is invalid." }, 500);
    } catch {
      return json({ error: "Stored site content is unreadable." }, 500);
    }
  }

  if (request.method !== "PUT") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!(await authenticate(request, env))) {
    return json({ error: "Owner login required." }, 401);
  }
  const body = (await request.json()) as { document?: unknown };
  if (!isSiteDocument(body.document)) {
    return json({ error: "The site document is invalid or too large." }, 400);
  }
  await env.DB.prepare(
    `INSERT INTO myhome_content (id, document, updated_at)
     VALUES (1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       document = excluded.document,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(JSON.stringify(body.document))
    .run();
  return json({ saved: true, document: body.document });
}

async function handleSetup(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 24) {
    return json(
      { error: "SESSION_SECRET must be configured before first setup." },
      500,
    );
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM myhome_owner WHERE id = 1",
  ).first();
  if (existing) return json({ error: "MyHome already has an owner." }, 409);

  const body = (await request.json()) as {
    owner?: { email?: unknown; password?: unknown };
    document?: unknown;
  };
  const email = cleanText(body.owner?.email, 254).toLowerCase();
  const password =
    typeof body.owner?.password === "string" ? body.owner.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid owner email." }, 400);
  }
  if (password.length < 12 || password.length > 256) {
    return json({ error: "The owner password must be 12–256 characters." }, 400);
  }
  if (!isSiteDocument(body.document) || !body.document.configured) {
    return json({ error: "The first site document is invalid." }, 400);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePassword(
    password,
    salt,
    passwordIterations,
    env.SESSION_SECRET,
  );
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO myhome_owner
          (id, email, password_hash, password_salt, password_iterations)
         VALUES (1, ?, ?, ?, ?)`,
      ).bind(
        email,
        passwordHash,
        bytesToBase64(salt),
        passwordIterations,
      ),
      env.DB.prepare(
        `INSERT INTO myhome_content (id, document)
         VALUES (1, ?)`,
      ).bind(JSON.stringify(body.document)),
    ]);
  } catch {
    return json({ error: "Owner setup has already been completed." }, 409);
  }
  const session = await createSession(request, env);
  return json(
    { configured: true },
    201,
    { "set-cookie": session.cookie },
  );
}

async function handleLogin(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!env.SESSION_SECRET) return json({ error: "Server login is not configured." }, 500);
  const body = (await request.json()) as {
    email?: unknown;
    password?: unknown;
  };
  const email = cleanText(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const owner = await env.DB.prepare(
    `SELECT email, password_hash, password_salt, password_iterations
     FROM myhome_owner WHERE id = 1`,
  ).first<{
    email: string;
    password_hash: string;
    password_salt: string;
    password_iterations: number;
  }>();
  if (!owner) return json({ error: "Complete first setup before logging in." }, 409);
  const derived = await derivePassword(
    password.slice(0, 256),
    base64ToBytes(owner.password_salt),
    owner.password_iterations,
    env.SESSION_SECRET,
  );
  if (
    email !== owner.email ||
    !constantTimeEqual(derived, owner.password_hash)
  ) {
    return json({ error: "Email or password is incorrect." }, 401);
  }
  await env.DB.prepare(
    "DELETE FROM myhome_sessions WHERE expires_at <= ?",
  )
    .bind(new Date().toISOString())
    .run();
  const session = await createSession(request, env);
  return json({ authenticated: true }, 200, { "set-cookie": session.cookie });
}

async function handleSession(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  return (await authenticate(request, env))
    ? json({ authenticated: true })
    : json({ authenticated: false }, 401);
}

async function handleLogout(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  const token = cookieValue(request, sessionCookieName);
  if (token && env.SESSION_SECRET) {
    const tokenHash = await sha256(`${token}\u0000${env.SESSION_SECRET}`);
    await env.DB.prepare(
      "DELETE FROM myhome_sessions WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .run();
  }
  return json(
    { authenticated: false },
    200,
    { "set-cookie": sessionCookie(request, "", 0) },
  );
}

async function handleUpload(request: Request, env: Env) {
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!(await authenticate(request, env))) {
    return json({ error: "Owner login required." }, 401);
  }

  if (request.method === "PUT") {
    const url = new URL(request.url);
    const objectKey = cleanText(url.searchParams.get("objectKey"), 260);
    const uploadId = cleanText(url.searchParams.get("uploadId"), 80);
    const partNumber = Number(url.searchParams.get("partNumber"));
    const id = idFromObjectKey(objectKey);
    if (
      !id ||
      !validUuid(uploadId) ||
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > 100
    ) {
      return json({ error: "Upload chunk is invalid." }, 400);
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > uploadChunkBytes) {
      return json({ error: "Upload chunks must be 1 MB or smaller." }, 413);
    }
    const object = await env.MEDIA.put(
      stagingKey(id, uploadId, partNumber),
      bytes,
      { customMetadata: { partNumber: String(partNumber) } },
    );
    return json({ part: { partNumber, etag: object.etag } });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  const body = (await request.json()) as Record<string, unknown>;
  const action = cleanText(body.action, 20);
  if (action === "start") {
    const descriptor = readUploadDescriptor(body);
    if ("error" in descriptor) {
      return json({ error: descriptor.error }, descriptor.status);
    }
    const id = crypto.randomUUID();
    const uploadId = crypto.randomUUID();
    return json({
      upload: {
        id,
        uploadId,
        objectKey: `${descriptor.kind}/${id}.${extensionFor(descriptor.mimeType)}`,
        chunkBytes: uploadChunkBytes,
        ...descriptor,
      },
    });
  }

  const objectKey = cleanText(body.objectKey, 260);
  const uploadId = cleanText(body.uploadId, 80);
  const id = idFromObjectKey(objectKey);
  if (!id || !validUuid(uploadId)) {
    return json({ error: "Upload session is invalid." }, 400);
  }
  if (action === "abort") {
    await deleteStaging(env.MEDIA, id, uploadId);
    return json({ aborted: true });
  }
  if (action !== "complete") {
    return json({ error: "Unknown upload action." }, 400);
  }

  const descriptor = readUploadDescriptor(body);
  if ("error" in descriptor) {
    return json({ error: descriptor.error }, descriptor.status);
  }
  if (
    cleanText(body.id, 80) !== id ||
    objectKey !==
      `${descriptor.kind}/${id}.${extensionFor(descriptor.mimeType)}`
  ) {
    return json({ error: "Upload session is invalid." }, 400);
  }
  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .map((part) => {
      const value = part as Record<string, unknown>;
      return {
        partNumber: Number(value.partNumber),
        etag: cleanText(value.etag, 220),
      };
    })
    .sort((left, right) => left.partNumber - right.partNumber) as UploadPart[];
  const expectedPartCount = Math.ceil(descriptor.size / uploadChunkBytes);
  if (
    parts.length !== expectedPartCount ||
    !parts.every(
      (part, index) =>
        part.partNumber === index + 1 &&
        Number.isInteger(part.partNumber) &&
        Boolean(part.etag),
    )
  ) {
    return json({ error: "One or more upload chunks are missing." }, 400);
  }

  const staged = await Promise.all(
    parts.map(async (part, index) => {
      const object = await env.MEDIA.get(
        stagingKey(id, uploadId, part.partNumber),
      );
      const expectedSize = Math.min(
        uploadChunkBytes,
        descriptor.size - index * uploadChunkBytes,
      );
      if (!object || object.etag !== part.etag || object.size !== expectedSize) {
        throw new Error(`Upload part ${part.partNumber} is incomplete.`);
      }
      return new Uint8Array(await object.arrayBuffer());
    }),
  );
  const finalBytes = new Uint8Array(descriptor.size);
  let offset = 0;
  for (const bytes of staged) {
    finalBytes.set(bytes, offset);
    offset += bytes.byteLength;
  }
  await env.MEDIA.put(objectKey, finalBytes, {
    httpMetadata: {
      contentType: descriptor.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: descriptor.name,
      credit: descriptor.credit,
    },
  });
  try {
    await env.DB.prepare(
      `INSERT INTO myhome_assets
        (id, object_key, original_name, mime_type, size, kind, credit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        objectKey,
        descriptor.name,
        descriptor.mimeType,
        descriptor.size,
        descriptor.kind,
        descriptor.credit,
      )
      .run();
  } catch (error) {
    await env.MEDIA.delete(objectKey);
    await deleteStaging(env.MEDIA, id, uploadId);
    throw error;
  }
  await deleteStaging(env.MEDIA, id, uploadId).catch(() => undefined);
  return json(
    {
      asset: {
        id,
        url: `/api/assets/${id}`,
        kind: descriptor.kind,
        mimeType: descriptor.mimeType,
        name: descriptor.name,
        credit: descriptor.credit,
      },
    },
    201,
  );
}

async function handleAsset(
  request: Request,
  env: Env,
  assetId: string,
) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!validUuid(assetId)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare(
    "SELECT object_key, mime_type FROM myhome_assets WHERE id = ?",
  )
    .bind(assetId)
    .first<{ object_key: string; mime_type: string }>();
  if (!row) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(row.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", row.mime_type);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

async function api(request: Request, env: Env) {
  await ensureSchema(env.DB);
  const url = new URL(request.url);
  if (url.pathname === "/api/site") return handleSite(request, env);
  if (url.pathname === "/api/setup") return handleSetup(request, env);
  if (url.pathname === "/api/login") return handleLogin(request, env);
  if (url.pathname === "/api/session") return handleSession(request, env);
  if (url.pathname === "/api/logout") return handleLogout(request, env);
  if (url.pathname === "/api/upload") return handleUpload(request, env);
  const assetMatch = /^\/api\/assets\/([0-9a-f-]{36})$/i.exec(url.pathname);
  if (assetMatch) return handleAsset(request, env, assetMatch[1]);
  return json({ error: "API route not found." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return securityHeaders(await api(request, env));
      }
      return securityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error("MyHome worker error", error);
      return securityHeaders(
        json({ error: "MyHome encountered a server error." }, 500),
      );
    }
  },
} satisfies ExportedHandler<Env>;
