import type { MediaRef } from "./types";
import { developerConfig } from "./config/developer";
import { runtimeMode } from "./runtime";

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

export function fileToDataUrl(
  file: File,
  kind: "image" | "audio",
): Promise<string> {
  const allowed = kind === "image" ? imageTypes : audioTypes;
  const maxBytes = kind === "image" ? 10 * 1024 * 1024 : 18 * 1024 * 1024;
  if (!allowed.has(file.type)) {
    throw new Error(`That ${kind} file type is not supported.`);
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(
      `${kind === "image" ? "Images" : "Audio"} must be smaller than ${maxBytes / 1024 / 1024} MB.`,
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readUploadJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: ({ error?: string } & T) | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as { error?: string } & T;
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const fallback =
      response.status === 413
        ? "That file is too large. Images must be under 10 MB and audio under 18 MB."
        : "The upload failed before the server returned details.";
    throw new Error(payload?.error || fallback);
  }
  if (!payload) throw new Error("The upload returned an invalid response.");
  return payload;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function storeMediaFile(
  file: File,
  kind: "image" | "audio",
  credit = "",
) {
  if (runtimeMode === "static") return fileToDataUrl(file, kind);

  const maxBytes = kind === "image" ? 10 * 1024 * 1024 : 18 * 1024 * 1024;
  const allowed = kind === "image" ? imageTypes : audioTypes;
  if (!allowed.has(file.type)) {
    throw new Error(`That ${kind} file type is not supported.`);
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(
      `${kind === "image" ? "Images" : "Audio"} must be smaller than ${maxBytes / 1024 / 1024} MB.`,
    );
  }
  const descriptor = {
    kind,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    credit: credit || "Credit information pending",
  };
  const startResponse = await fetch(`${developerConfig.apiBase}/upload`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", ...descriptor }),
  });
  const start = await readUploadJson<{
    upload: {
      id: string;
      objectKey: string;
      uploadId: string;
      chunkBytes: number;
    };
  }>(startResponse);
  const session = start.upload;
  const parts: Array<{ partNumber: number; etag: string }> = [];
  const totalParts = Math.ceil(file.size / session.chunkBytes);

  try {
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1;
      const chunk = file.slice(
        index * session.chunkBytes,
        Math.min(file.size, (index + 1) * session.chunkBytes),
      );
      let uploaded: { partNumber: number; etag: string } | null = null;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(
            `${developerConfig.apiBase}/upload?objectKey=${encodeURIComponent(session.objectKey)}&uploadId=${encodeURIComponent(session.uploadId)}&partNumber=${partNumber}`,
            {
              method: "PUT",
              credentials: "include",
              headers: { "content-type": "application/octet-stream" },
              body: chunk,
            },
          );
          uploaded = (
            await readUploadJson<{
              part: { partNumber: number; etag: string };
            }>(response)
          ).part;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await wait(attempt * 650);
        }
      }
      if (!uploaded) {
        throw new Error(
          `The connection kept dropping on part ${partNumber}${
            lastError instanceof Error ? ` (${lastError.message})` : ""
          }.`,
        );
      }
      parts.push(uploaded);
    }

    const completeResponse = await fetch(`${developerConfig.apiBase}/upload`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        ...descriptor,
        id: session.id,
        objectKey: session.objectKey,
        uploadId: session.uploadId,
        parts,
      }),
    });
    const completed = await readUploadJson<{
      asset: { url: string };
    }>(completeResponse);
    return completed.asset.url;
  } catch (error) {
    await fetch(`${developerConfig.apiBase}/upload`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "abort",
        objectKey: session.objectKey,
        uploadId: session.uploadId,
      }),
    }).catch(() => undefined);
    throw error;
  }
}

export function mediaFromUrl(
  src: string,
  alt = "",
  credit = "",
  sourceUrl = "",
): MediaRef {
  return { src, alt, credit, sourceUrl };
}

export function isDisplayableImage(media: MediaRef | undefined) {
  return Boolean(media?.src);
}
