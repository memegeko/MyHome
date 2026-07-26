import type { OwnerEnvelope, SiteDocument } from "./types";

function publicDocument(document: SiteDocument): SiteDocument {
  return {
    ...document,
    pages: document.pages.filter((page) => !page.private),
    blocks: document.blocks.filter((block) => !block.private),
    socials: document.socials.filter((social) => !social.private),
  };
}

async function githubRequest(
  token: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    sha?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message || `GitHub returned ${response.status}.`);
  }
  return payload;
}

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function updateFile(
  token: string,
  owner: string,
  repository: string,
  branch: string,
  path: string,
  content: string,
) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const current: { sha?: string } = await githubRequest(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
  ).catch(() => ({}));
  await githubRequest(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: "Update MyHome from Studio",
        branch,
        content: utf8ToBase64(content),
        ...(current.sha ? { sha: current.sha } : {}),
      }),
    },
  );
}

export async function publishToGitHub({
  token,
  owner,
  repository,
  branch,
  document,
  envelope,
}: {
  token: string;
  owner: string;
  repository: string;
  branch: string;
  document: SiteDocument;
  envelope: OwnerEnvelope;
}) {
  if (!token || !owner || !repository || !branch) {
    throw new Error("Complete every GitHub publishing field first.");
  }
  await updateFile(
    token,
    owner,
    repository,
    branch,
    "public/myhome.json",
    `${JSON.stringify(publicDocument(document), null, 2)}\n`,
  );
  await updateFile(
    token,
    owner,
    repository,
    branch,
    "public/myhome.owner.json",
    `${JSON.stringify(envelope, null, 2)}\n`,
  );
}
