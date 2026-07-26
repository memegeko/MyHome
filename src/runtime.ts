import { developerConfig } from "./config/developer";
import { aeroAppearance, createBlankDocument } from "./defaults";
import type { OwnerEnvelope, RuntimeMode, SiteDocument } from "./types";

const databaseName = "myhome-studio";
const storeName = "documents";
const documentKey = "current";
const ownerKey = "owner-envelope";

export const runtimeMode: RuntimeMode =
  import.meta.env.VITE_MYHOME_MODE === "server" ? "server" : "static";

function isSiteDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<SiteDocument>;
  return (
    document.formatVersion === 1 &&
    typeof document.configured === "boolean" &&
    typeof document.siteTitle === "string" &&
    Boolean(document.profile) &&
    Array.isArray(document.pages) &&
    Array.isArray(document.blocks) &&
    Array.isArray(document.socials) &&
    Boolean(document.appearance)
  );
}

function normalizeDocument(document: SiteDocument): SiteDocument {
  return {
    ...document,
    appearance: {
      ...aeroAppearance(),
      ...document.appearance,
      pageStyles: document.appearance.pageStyles || {},
    },
  };
}

function openStudioDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLocalDocument() {
  const database = await openStudioDatabase();
  return new Promise<SiteDocument | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(documentKey);
    request.onsuccess = () =>
      resolve(isSiteDocument(request.result) ? request.result : null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeLocalDocument(document: SiteDocument) {
  const database = await openStudioDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(document, documentKey);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function readLocalValue<T>(key: string): Promise<T | null> {
  const database = await openStudioDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeLocalValue<T>(key: string, value: T) {
  const database = await openStudioDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function isOwnerEnvelope(value: unknown): value is OwnerEnvelope {
  const envelope = value as Partial<OwnerEnvelope> | null;
  return Boolean(
    envelope &&
      envelope.format === "myhome-owner" &&
      envelope.version === 1 &&
      envelope.email &&
      envelope.password?.ciphertext &&
      envelope.recovery?.ciphertext,
  );
}

export async function loadOwnerEnvelope(): Promise<OwnerEnvelope | null> {
  const local = await readLocalValue<OwnerEnvelope>(ownerKey).catch(() => null);
  if (isOwnerEnvelope(local)) return local;
  const response = await fetch("./myhome.owner.json", { cache: "no-store" }).catch(
    () => null,
  );
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as unknown;
  return isOwnerEnvelope(payload) ? payload : null;
}

export async function saveOwnerEnvelope(envelope: OwnerEnvelope) {
  await writeLocalValue(ownerKey, envelope);
}

export async function loadDocument(): Promise<SiteDocument> {
  if (runtimeMode === "server") {
    const response = await fetch(`${developerConfig.apiBase}/site`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) {
      const payload = (await response.json()) as { document?: unknown };
      if (isSiteDocument(payload.document)) return normalizeDocument(payload.document);
    }
  } else {
    const local = await readLocalDocument().catch(() => null);
    if (local) return normalizeDocument(local);
  }

  const response = await fetch(developerConfig.contentPath, {
    cache: "no-store",
  });
  if (response.ok) {
    const payload = (await response.json()) as unknown;
    if (isSiteDocument(payload)) return normalizeDocument(payload);
  }
  return createBlankDocument();
}

export async function saveDocument(document: SiteDocument) {
  const next: SiteDocument = {
    ...document,
    updatedAt: new Date().toISOString(),
  };
  if (runtimeMode === "server") {
    const response = await fetch(`${developerConfig.apiBase}/site`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document: next }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "The server could not save the site.");
    }
    return next;
  }
  await writeLocalDocument(next);
  return next;
}

export async function resetLocalDocument() {
  const database = await openStudioDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(documentKey);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
