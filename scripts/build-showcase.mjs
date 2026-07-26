import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const sourcePath = path.join(root, "public/examples/showcase.json");
const outputPath = path.join(root, "public/examples/myhome-showcase.zip");
const document = JSON.parse(await readFile(sourcePath, "utf8"));

const assetFiles = [
  "avatar.svg",
  "project-aero.svg",
  "project-media.svg",
  "record-glass.svg",
  "anime-skybound.svg",
  "gallery-aero.svg",
];

function rewrite(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((item) => rewrite(item, transform));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewrite(item, transform)]),
    );
  }
  return value;
}

const archive = new JSZip();
const assets = [];
const packedDocument = rewrite(document, (value) => {
  const prefix = "./examples/assets/";
  if (!value.startsWith(prefix)) return value;
  const filename = value.slice(prefix.length);
  const packedPath = `assets/${filename}`;
  const placeholder = `myhome-asset://${packedPath}`;
  if (!assets.some((asset) => asset.placeholder === placeholder)) {
    assets.push({
      placeholder,
      path: packedPath,
      mimeType: "image/png",
    });
  }
  return placeholder;
});

for (const filename of assetFiles) {
  archive.file(
    `assets/${filename}`,
    await readFile(path.join(root, "public/examples/assets", filename)),
  );
}

archive.file(
  "myhome-backup.json",
  JSON.stringify(
    {
      format: "myhome-site-bundle",
      version: 1,
      exportedAt: new Date().toISOString(),
      document: packedDocument,
      assets,
    },
    null,
    2,
  ),
);

archive.file(
  "myhome.json",
  JSON.stringify(
    rewrite(packedDocument, (value) =>
      value.startsWith("myhome-asset://")
        ? `./${value.slice("myhome-asset://".length)}`
        : value,
    ),
    null,
    2,
  ),
);

archive.file(
  "README.txt",
  [
    "MyHome showcase bundle",
    "",
    "Import this ZIP from MyHome Studio:",
    "Customize -> Import & export -> Choose backup.",
    "",
    "Every person, project, record and anime title in this bundle is fictional.",
    "Replace all example text and artwork with your own content.",
    "",
    "Live showcase: https://memegeko.github.io/MyHome/?demo=showcase",
  ].join("\n"),
);

const bytes = await archive.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});
await writeFile(outputPath, bytes);
console.log(`Created ${path.relative(root, outputPath)} (${bytes.length} bytes)`);
