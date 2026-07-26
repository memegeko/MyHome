import JSZip from "jszip";
import type { SiteDocument, ThemePreset } from "./types";

type PackedAsset = {
  placeholder: string;
  path: string;
  mimeType: string;
};

type BackupManifest = {
  format: "myhome-site-bundle";
  version: 1;
  exportedAt: string;
  document: SiteDocument;
  assets: PackedAsset[];
};

function rewriteStrings<T>(
  value: T,
  rewrite: (current: string) => string,
): T {
  if (typeof value === "string") return rewrite(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => rewriteStrings(item, rewrite)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteStrings(item, rewrite),
      ]),
    ) as T;
  }
  return value;
}

function collectMediaUrls(value: unknown, found = new Set<string>()) {
  if (typeof value === "string") {
    if (
      value.startsWith("data:image/") ||
      value.startsWith("data:audio/") ||
      /^\/api\/assets\/[0-9a-f-]{36}$/i.test(value)
    ) {
      found.add(value);
    }
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaUrls(item, found));
    return found;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectMediaUrls(item, found));
  }
  return found;
}

function extensionForMimeType(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
  };
  return extensions[mimeType] || "bin";
}

function dataUrlToBytes(value: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) throw new Error("An embedded media file is malformed.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType: match[1], bytes };
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function exportSiteBundle(document: SiteDocument) {
  const archive = new JSZip();
  const replacements = new Map<string, string>();
  const assets: PackedAsset[] = [];
  const urls = [...collectMediaUrls(document)];

  for (let index = 0; index < urls.length; index += 1) {
    const source = urls[index];
    let mimeType: string;
    let bytes: Uint8Array;
    if (source.startsWith("data:")) {
      const decoded = dataUrlToBytes(source);
      mimeType = decoded.mimeType;
      bytes = decoded.bytes;
    } else {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Could not include local media file ${index + 1}.`);
      }
      mimeType = (response.headers.get("content-type") || "application/octet-stream")
        .split(";")[0]
        .trim();
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    const path = `assets/media-${String(index + 1).padStart(3, "0")}.${extensionForMimeType(mimeType)}`;
    const placeholder = `myhome-asset://${path}`;
    archive.file(path, bytes);
    replacements.set(source, placeholder);
    assets.push({ placeholder, path, mimeType });
  }

  const packedDocument = rewriteStrings(
    document,
    (value) => replacements.get(value) || value,
  );
  const manifest: BackupManifest = {
    format: "myhome-site-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    document: packedDocument,
    assets,
  };
  const deployableDocument = rewriteStrings(packedDocument, (value) =>
    value.startsWith("myhome-asset://")
      ? `./${value.slice("myhome-asset://".length)}`
      : value,
  );

  archive.file("myhome-backup.json", JSON.stringify(manifest, null, 2));
  archive.file("myhome.json", JSON.stringify(deployableDocument, null, 2));
  archive.file(
    "README.txt",
    [
      "MyHome full-site bundle",
      "",
      "Import this ZIP in the MyHome setup studio or admin panel.",
      "For a static deployment, copy myhome.json and the assets folder into public/ before building.",
      "External media URLs remain external references.",
      "",
    ].join("\n"),
  );
  return archive.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function importSiteBundle(
  file: File,
  restoreMedia?: (
    bytes: Uint8Array,
    mimeType: string,
    path: string,
  ) => Promise<string>,
): Promise<SiteDocument> {
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(await file.text()) as SiteDocument;
    if (parsed.formatVersion !== 1) {
      throw new Error("That JSON file is not a supported MyHome document.");
    }
    return parsed;
  }

  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = archive.file("myhome-backup.json");
  if (!manifestFile) {
    throw new Error("This ZIP does not contain a MyHome backup manifest.");
  }
  const manifest = JSON.parse(
    await manifestFile.async("text"),
  ) as BackupManifest;
  if (
    manifest.format !== "myhome-site-bundle" ||
    manifest.version !== 1 ||
    manifest.document?.formatVersion !== 1 ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error("This is not a supported MyHome backup.");
  }
  if (manifest.assets.length > 250) {
    throw new Error("This backup contains too many media files.");
  }

  let document = manifest.document;
  for (const asset of manifest.assets) {
    const safePath =
      /^assets\/[a-z0-9._/-]+$/i.test(asset.path) &&
      !asset.path.includes("..");
    if (
      !safePath ||
      asset.placeholder !== `myhome-asset://${asset.path}` ||
      !/^(image|audio)\//.test(asset.mimeType)
    ) {
      throw new Error("The backup contains invalid media metadata.");
    }
    const entry = archive.file(asset.path);
    if (!entry) throw new Error(`The backup is missing ${asset.path}.`);
    const bytes = await entry.async("uint8array");
    const restoredUrl = restoreMedia
      ? await restoreMedia(bytes, asset.mimeType, asset.path)
      : bytesToDataUrl(bytes, asset.mimeType);
    document = rewriteStrings(document, (value) =>
      value === asset.placeholder ? restoredUrl : value,
    );
  }
  return document;
}

export function exportThemePreset(preset: ThemePreset) {
  return new Blob([JSON.stringify(preset, null, 2)], {
    type: "application/json",
  });
}

export async function importThemePreset(file: File): Promise<ThemePreset> {
  const parsed = JSON.parse(await file.text()) as ThemePreset;
  if (
    parsed.format !== "myhome-theme" ||
    parsed.version !== 1 ||
    !parsed.appearance
  ) {
    throw new Error("That file is not a supported MyHome theme.");
  }
  return parsed;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
