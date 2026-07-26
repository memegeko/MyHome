import type {
  OwnerEnvelope,
  SiteDocument,
  StaticSessionPreference,
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 310_000;

function webCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Encrypted owner setup requires HTTPS or a localhost development address.",
    );
  }
  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number) {
  return webCrypto().getRandomValues(new Uint8Array(length));
}

async function deriveKey(secret: string, salt: Uint8Array) {
  const safeSalt = new Uint8Array(salt);
  const material = await webCrypto().subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return webCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: safeSalt,
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(secret: string, document: SiteDocument) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(secret, salt);
  const encrypted = await webCrypto().subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(document)),
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

async function open(
  secret: string,
  payload: OwnerEnvelope["password"],
): Promise<SiteDocument> {
  try {
    const key = await deriveKey(secret, fromBase64(payload.salt));
    const decrypted = await webCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext),
    );
    const document = JSON.parse(decoder.decode(decrypted)) as SiteDocument;
    if (document.formatVersion !== 1) throw new Error("Unsupported document.");
    return document;
  } catch {
    throw new Error("The email, password or recovery key is incorrect.");
  }
}

export function generateRecoveryKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return raw.match(/.{1,6}/g)?.join("-") || raw;
}

export async function createOwnerEnvelope(
  email: string,
  password: string,
  recoveryKey: string,
  sessionPreference: StaticSessionPreference,
  document: SiteDocument,
): Promise<OwnerEnvelope> {
  return {
    format: "myhome-owner",
    version: 1,
    email: email.trim().toLowerCase(),
    sessionPreference,
    password: await seal(password, document),
    recovery: await seal(recoveryKey.replace(/\s/g, "").toUpperCase(), document),
    updatedAt: new Date().toISOString(),
  };
}

export async function unlockOwnerEnvelope(
  envelope: OwnerEnvelope,
  email: string,
  secret: string,
  recovery = false,
) {
  if (!recovery && email.trim().toLowerCase() !== envelope.email) {
    throw new Error("The email, password or recovery key is incorrect.");
  }
  return open(
    recovery ? secret.replace(/\s/g, "").toUpperCase() : secret,
    recovery ? envelope.recovery : envelope.password,
  );
}
