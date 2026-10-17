export type YptClaimStatus = "PENDING" | "VERIFIED" | "REJECTED" | "REVOKED";

export class InvalidYptClaimTransitionError extends Error {
   constructor(
      public readonly from: YptClaimStatus,
      public readonly to: YptClaimStatus
   ) {
      super(`Cannot transition YPT claim from ${from} to ${to}.`);
      this.name = "InvalidYptClaimTransitionError";
   }
}

/**
 * Valid transitions according to Section 27:
 * PENDING → VERIFIED
 * PENDING → REJECTED
 * VERIFIED → REVOKED
 * REJECTED → PENDING
 * REVOKED → PENDING (re-linking / retry)
 */
export function isValidClaimTransition(
   from: YptClaimStatus,
   to: YptClaimStatus
): boolean {
   if (from === to) return true; // idempotent

   switch (from) {
      case "PENDING":
         return to === "VERIFIED" || to === "REJECTED";
      case "VERIFIED":
         return to === "REVOKED";
      case "REJECTED":
         return to === "PENDING";
      case "REVOKED":
         return to === "PENDING";
      default:
         return false;
   }
}

export function assertValidClaimTransition(
   from: YptClaimStatus,
   to: YptClaimStatus
): void {
   if (!isValidClaimTransition(from, to)) {
      throw new InvalidYptClaimTransitionError(from, to);
   }
}
