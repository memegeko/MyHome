import { describe, expect, it } from "vitest";
import { validateSetup, ownerSeed } from "./cloudflare-setup-lib.mjs";

const valid = { name: "test-home", accountId: "a".repeat(32), displayName: "Owner", username: "owner", email: "owner@example.com", login: "password", password: "long-test-password", accent: "#24c8c0" };
describe("Cloudflare installer input", () => {
  it("rejects unsafe names and missing login credentials", () => {
    expect(() => validateSetup({ ...valid, name: "../worker" })).toThrow();
    expect(() => validateSetup({ ...valid, accountId: "wrong" })).toThrow();
    expect(() => validateSetup({ ...valid, password: "short" })).toThrow();
    expect(() => validateSetup({ ...valid, login: "github" })).toThrow();
    expect(validateSetup(valid).uploads).toBe(false);
  });
  it("validates advanced settings and unsafe media sources", () => {
    const options = validateSetup({ ...valid, particleType: "snow", particleAmount: "32", borderRadius: "0", siteTitle: "My space", avatarUrl: "https://example.com/avatar.png" });
    expect(options.appearance.particleAmount).toBe(32);
    expect(options.appearance.borderRadius).toBe(0);
    expect(options.siteTitle).toBe("My space");
    expect(() => validateSetup({ ...valid, avatarUrl: "javascript:alert(1)" })).toThrow();
    expect(() => validateSetup({ ...valid, particleAmount: "999" })).toThrow();
    expect(() => validateSetup({ ...valid, backgroundMode: "invalid" })).toThrow();
  });
  it("escapes profile content in the seed without allowing owner replacement", () => {
    const sql = ownerSeed({ email: "owner@example.com", hash: "hash", salt: "salt", recoveryHash: "recovery", document: { bio: "I'm here'; DROP TABLE myhome_owner; --" } });
    expect(sql).toContain("I''m here''; DROP TABLE");
    expect(sql).not.toContain("ON CONFLICT");
    expect(sql).not.toContain("INSERT OR REPLACE");
  });
  it("keeps theme preferences and rejects unsupported fonts", () => {
    const options = validateSetup({ ...valid, fontFamily: "tahoma", animations: false });
    expect(options.fontFamily).toBe("Tahoma, Geneva, sans-serif");
    expect(options.animations).toBe(false);
    expect(validateSetup(valid).animations).toBe(true);
    expect(() => validateSetup({ ...valid, fontFamily: "arbitrary-font" })).toThrow();
  });
});
