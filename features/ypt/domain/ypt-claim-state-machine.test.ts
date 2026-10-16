import { describe, expect, it } from "vitest";
import {
   isValidClaimTransition,
   assertValidClaimTransition,
   InvalidYptClaimTransitionError,
   type YptClaimStatus,
} from "./ypt-claim-state-machine";

describe("YPT Claim State Machine", () => {
   it("allows valid transitions", () => {
      expect(isValidClaimTransition("PENDING", "VERIFIED")).toBe(true);
      expect(isValidClaimTransition("PENDING", "REJECTED")).toBe(true);
      expect(isValidClaimTransition("VERIFIED", "REVOKED")).toBe(true);
      expect(isValidClaimTransition("REJECTED", "PENDING")).toBe(true);
      expect(isValidClaimTransition("REVOKED", "PENDING")).toBe(true);
      expect(isValidClaimTransition("PENDING", "PENDING")).toBe(true);
   });

   it("rejects invalid transitions", () => {
      expect(isValidClaimTransition("PENDING", "REVOKED")).toBe(false);
      expect(isValidClaimTransition("VERIFIED", "PENDING")).toBe(false);
      expect(isValidClaimTransition("VERIFIED", "REJECTED")).toBe(false);
      expect(isValidClaimTransition("REJECTED", "VERIFIED")).toBe(false);
      expect(isValidClaimTransition("REJECTED", "REVOKED")).toBe(false);
      expect(isValidClaimTransition("REVOKED", "VERIFIED")).toBe(false);
   });

   it("throws InvalidYptClaimTransitionError on assertion failure", () => {
      expect(() => assertValidClaimTransition("VERIFIED", "PENDING")).toThrow(
         InvalidYptClaimTransitionError
      );
      expect(() =>
         assertValidClaimTransition("PENDING", "VERIFIED")
      ).not.toThrow();
   });
});
