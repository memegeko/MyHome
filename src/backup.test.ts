import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { exportSiteBundle, importSiteBundle } from "./backup";
import { createBlankDocument } from "./defaults";

describe("portable MyHome bundle", () => {
  it("round-trips locally embedded media", async () => {
    const document = createBlankDocument();
    document.configured = true;
    document.profile.displayName = "Example";
    document.profile.avatar = {
      src: "data:image/png;base64,iVBORw0KGgo=",
      alt: "Example avatar",
      credit: "Example creator",
      sourceUrl: "",
    };

    const blob = await exportSiteBundle(document);
    const imported = await importSiteBundle(
      new File([blob], "myhome-full-site.zip", {
        type: "application/zip",
      }),
    );

    expect(imported.profile.displayName).toBe("Example");
    expect(imported.profile.avatar.src).toMatch(/^data:image\/png;base64,/);
    expect(imported.profile.avatar.credit).toBe("Example creator");
  });

  it("imports the committed showcase bundle", async () => {
    const bytes = await readFile("public/examples/myhome-showcase.zip");
    const imported = await importSiteBundle(
      new File([bytes], "myhome-showcase.zip", {
        type: "application/zip",
      }),
    );

    expect(imported.profile.displayName).toBe("Nova");
    expect(imported.pages.filter((page) => page.enabled)).toHaveLength(6);
    expect(imported.blocks.map((block) => block.type)).toEqual(
      expect.arrayContaining([
        "about",
        "custom",
        "projects",
        "records",
        "anime",
        "gallery",
        "people",
        "places",
      ]),
    );
    expect(imported.profile.avatar.src).toMatch(/^data:image\/png;base64,/);
  });
});
