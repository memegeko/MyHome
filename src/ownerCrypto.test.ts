import { describe, expect, it } from "vitest";
import { createBlankDocument } from "./defaults";
import {
  createOwnerEnvelope,
  generateRecoveryKey,
  unlockOwnerEnvelope,
} from "./ownerCrypto";

describe("static owner encryption", () => {
  it("unlocks with the password and recovery key", async () => {
    const document = createBlankDocument();
    document.configured = true;
    document.profile.displayName = "Encrypted Owner";
    const recoveryKey = generateRecoveryKey();
    const envelope = await createOwnerEnvelope(
      "owner@example.com",
      "Strong-Test-Password-42!",
      recoveryKey,
      "always",
      document,
    );

    const passwordCopy = await unlockOwnerEnvelope(
      envelope,
      "owner@example.com",
      "Strong-Test-Password-42!",
    );
    const recoveredCopy = await unlockOwnerEnvelope(
      envelope,
      "",
      recoveryKey,
      true,
    );

    expect(passwordCopy.profile.displayName).toBe("Encrypted Owner");
    expect(recoveredCopy.profile.displayName).toBe("Encrypted Owner");
    expect(envelope.password.ciphertext).not.toContain("Encrypted Owner");
  });
});
