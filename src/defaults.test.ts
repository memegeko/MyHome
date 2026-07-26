import { describe, expect, it } from "vitest";
import { aeroThemePreset, createBlankDocument } from "./defaults";

describe("blank MyHome document", () => {
  it("starts unconfigured and contains no personal content", () => {
    const document = createBlankDocument();
    expect(document.configured).toBe(false);
    expect(document.profile.displayName).toBe("");
    expect(document.socials).toEqual([]);
    expect(document.blocks.every((block) => {
      if ("items" in block) return block.items.length === 0;
      return true;
    })).toBe(true);
  });

  it("ships a content-free Aero preset", () => {
    expect(aeroThemePreset.format).toBe("myhome-theme");
    expect(aeroThemePreset.appearance.background.src).toBe("");
    expect(aeroThemePreset.description).toContain("no personal text");
  });
});
