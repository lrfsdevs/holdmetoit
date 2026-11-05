import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { auth } from "@/core/auth";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import {
   findUserById,
   isUsernameAvailable,
   updateUsername,
   UsernameTakenError,
} from "@/features/auth/data/user.repository";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import {
   checkUsernameAvailabilityAction,
   updateUsernameAction,
} from "./username.actions";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn(),
}));

vi.mock("@/features/auth/data/user.repository", () => ({
   findUserById: vi.fn(),
   isUsernameAvailable: vi.fn(),
   updateUsername: vi.fn(),
   UsernameTakenError: class UsernameTakenError extends Error {
      constructor(username: string) {
         super(`Username "${username}" is already taken.`);
         this.name = "UsernameTakenError";
      }
   },
   InvalidUsernameError: class InvalidUsernameError extends Error {},
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn(),
}));

describe("username.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      // Default: flag enabled
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
   });

   describe("checkUsernameAvailabilityAction", () => {
      it("returns FEATURE_DISABLED when platform_username flag is off", async () => {
         vi.mocked(isFeatureEnabled).mockResolvedValue(false);

         const result = await checkUsernameAvailabilityAction("ValidUser");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FEATURE_DISABLED");
         }
      });

      it("returns available: false with reason for syntactically invalid input", async () => {
         const result = await checkUsernameAvailabilityAction("ab"); // too short
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.available).toBe(false);
            expect(result.data.reason).toMatch(/at least 3 characters/i);
         }
      });

      it("returns available: false when username is taken", async () => {
         vi.mocked(isUsernameAvailable).mockResolvedValue(false);

         const result = await checkUsernameAvailabilityAction("ExistingUser");
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.available).toBe(false);
            expect(result.data.reason).toMatch(/already taken/i);
         }
      });

      it("returns available: true when candidate is valid and unreserved", async () => {
         vi.mocked(isUsernameAvailable).mockResolvedValue(true);

         const result = await checkUsernameAvailabilityAction("FreshScholar");
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.available).toBe(true);
            expect(result.data.candidate).toBe("FreshScholar");
            expect(result.data.canonical).toBe("freshscholar");
            expect(result.data.reason).toBeUndefined();
         }
      });
   });

   describe("updateUsernameAction", () => {
      it("returns FEATURE_DISABLED when platform_username flag is off", async () => {
         vi.mocked(isFeatureEnabled).mockResolvedValue(false);

         const result = await updateUsernameAction("NewUser");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FEATURE_DISABLED");
         }
      });

      it("rejects unauthenticated requests", async () => {
         vi.mocked(auth).mockResolvedValue(null as never);

         const result = await updateUsernameAction("ValidName");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("AUTH_REQUIRED");
         }
      });

      it("rejects invalid usernames", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "user_1" },
         } as never);

         const result = await updateUsernameAction("_LeadingUnderscore");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE");
         }
      });

      it("enforces 7-day cooldown when user changed username recently", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "user_1" },
         } as never);

         // Changed 2 days ago
         const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
         vi.mocked(findUserById).mockResolvedValue({
            id: "user_1",
            username: "OldHandle",
            usernameChangedAt: twoDaysAgo,
         } as never);

         const result = await updateUsernameAction("NewHandle");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("COOLDOWN_ACTIVE");
            expect(result.message).toMatch(/5 day\(s\)/);
         }
      });

      it("handles username collision gracefully", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "user_1" },
         } as never);
         vi.mocked(findUserById).mockResolvedValue({
            id: "user_1",
            username: "OldHandle",
            usernameChangedAt: null,
         } as never);
         vi.mocked(updateUsername).mockRejectedValue(
            new UsernameTakenError("TakenHandle")
         );

         const result = await updateUsernameAction("TakenHandle");
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("USERNAME_TAKEN");
         }
      });

      it("successfully updates username, emits audit event, and revalidates paths", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: {
               id: "user_1",
               displayName: "Alice S",
               image: "alice.png",
            },
         } as never);

         const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
         vi.mocked(findUserById).mockResolvedValue({
            id: "user_1",
            username: "OldAlice",
            usernameChangedAt: eightDaysAgo,
            displayName: "Alice S",
         } as never);

         const updatedTimestamp = new Date();
         vi.mocked(updateUsername).mockResolvedValue({
            id: "user_1",
            username: "Alice_Scholar",
            usernameChangedAt: updatedTimestamp,
         } as never);

         const result = await updateUsernameAction("Alice_Scholar");

         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.username).toBe("Alice_Scholar");
            expect(result.data.usernameChangedAt).toBe(
               updatedTimestamp.toISOString()
            );
         }

         expect(updateUsername).toHaveBeenCalledWith("user_1", "Alice_Scholar");
         expect(recordAuditEvent).toHaveBeenCalledWith({
            actionType: "USERNAME_UPDATED",
            actorId: "user_1",
            actorUsername: "Alice_Scholar",
            actorDisplayName: "Alice S",
            actorImage: "alice.png",
            targetEntityType: "USER",
            targetEntityId: "user_1",
            targetEntityName: "Alice_Scholar",
            previousValue: { username: "OldAlice" },
            newValue: { username: "Alice_Scholar" },
         });

         expect(revalidatePath).toHaveBeenCalledWith("/profile");
         expect(revalidatePath).toHaveBeenCalledWith("/");
      });
   });
});
