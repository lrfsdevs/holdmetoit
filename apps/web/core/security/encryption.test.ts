import { describe, it, expect } from "vitest";
import { encryptSensitiveToken, decryptSensitiveToken } from "./encryption";

describe("core/security/encryption", () => {
   it("encrypts and decrypts a token correctly", () => {
      const original = "ypt-refresh-token-xyz-1234567890";
      const cipher = encryptSensitiveToken(original);

      expect(cipher).not.toBe(original);
      expect(typeof cipher).toBe("string");

      const decrypted = decryptSensitiveToken(cipher);
      expect(decrypted).toBe(original);
   });

   it("handles empty strings safely", () => {
      expect(encryptSensitiveToken("")).toBe("");
      expect(decryptSensitiveToken("")).toBe("");
   });

   it("throws when decrypting invalid corrupted payload", () => {
      expect(() =>
         decryptSensitiveToken("not-a-valid-base64-or-gcm")
      ).toThrow();
   });
});
