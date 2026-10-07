import type { SiteDocument } from "./types";

export function publicDocument(document: SiteDocument): SiteDocument {
  const privatePages = new Set(document.pages.filter((page) => page.private).map((page) => page.id));
  return {
    ...document,
    pages: document.pages.filter((page) => !page.private),
    blocks: document.blocks.filter((block) => !block.private && !privatePages.has(block.pageId)),
    socials: document.socials.filter((social) => !social.private),
  };
}
