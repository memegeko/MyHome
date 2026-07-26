import { describe, expect, it } from "vitest";
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
});
