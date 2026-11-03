import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getMySickStatusAction,
   respondSickReminderAction,
   toggleSickModeAction,
} from "./sick-mode.actions";
import { requireSessionUser } from "@/features/auth/api/require-session";
import {
   activateSickMode,
   deactivateSickMode,
   getUserSickStatus,
   snoozeSickReminder,
} from "../data/sick-mode.repository";

vi.mock("@/features/auth/api/require-session", () => {
   class AuthError extends Error {
      constructor(message = "You must sign in to continue.") {
         super(message);
         this.name = "AuthError";
      }
   }
   return {
      requireSessionUser: vi.fn(),
      AuthError,
   };
});

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("../data/sick-mode.repository", () => ({
   activateSickMode: vi.fn(),
   deactivateSickMode: vi.fn(),
   getUserSickStatus: vi.fn(),
   snoozeSickReminder: vi.fn(),
}));

describe("features/participant-status/api/sick-mode.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("toggleSickModeAction", () => {
      it("fails if user is not authenticated", async () => {
         const { AuthError } =
            await import("@/features/auth/api/require-session");
         vi.mocked(requireSessionUser).mockRejectedValue(
            new AuthError("You must sign in to continue.")
         );

         const res = await toggleSickModeAction({ isSick: true, note: null });
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.message).toBe("You must sign in to continue.");
         }
      });

      it("masks unexpected database errors without leaking internal connection or query strings", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(activateSickMode).mockRejectedValue(
            new Error(
               "FATAL: connection pool closed at postgres://postgres:secret@db.internal:5432/hmt"
            )
         );

         const res = await toggleSickModeAction({
            isSick: true,
            note: "Migraine",
         });
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.message).toBe(
               "An error occurred while updating Sick Mode."
            );
            expect(res.message).not.toContain("postgres://");
         }
      });

      it("fails if note exceeds maximum 80 characters", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);

         const res = await toggleSickModeAction({
            isSick: true,
            note: "a".repeat(81),
         });
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.message).toContain("80 characters");
         }
      });

      it("activates sick mode successfully", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(activateSickMode).mockResolvedValue({
            isSick: true,
            activatedAt: new Date("2026-11-01T10:00:00Z"),
            note: "Migraine",
            reminderSnoozedUntil: null,
            lastDeactivatedAt: null,
         });

         const res = await toggleSickModeAction({
            isSick: true,
            note: "Migraine",
         });
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.status.isSick).toBe(true);
            expect(res.status.note).toBe("Migraine");
         }
         expect(activateSickMode).toHaveBeenCalledWith("user-1", "Migraine");
      });

      it("deactivates sick mode successfully", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(deactivateSickMode).mockResolvedValue({
            isSick: false,
            activatedAt: null,
            note: null,
            reminderSnoozedUntil: null,
            lastDeactivatedAt: new Date(),
         });

         const res = await toggleSickModeAction({ isSick: false });
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.status.isSick).toBe(false);
         }
         expect(deactivateSickMode).toHaveBeenCalledWith("user-1");
      });
   });

   describe("respondSickReminderAction", () => {
      it("deactivates sick mode when action is turn_off", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(deactivateSickMode).mockResolvedValue({
            isSick: false,
            activatedAt: null,
            note: null,
            reminderSnoozedUntil: null,
            lastDeactivatedAt: new Date(),
         });

         const res = await respondSickReminderAction({ action: "turn_off" });
         expect(res.ok).toBe(true);
         expect(deactivateSickMode).toHaveBeenCalledWith("user-1");
      });

      it("snoozes reminder when action is extend", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(snoozeSickReminder).mockResolvedValue({
            isSick: true,
            activatedAt: new Date(),
            note: "Flu",
            reminderSnoozedUntil: new Date(),
            lastDeactivatedAt: null,
         });

         const res = await respondSickReminderAction({ action: "extend" });
         expect(res.ok).toBe(true);
         expect(snoozeSickReminder).toHaveBeenCalledWith("user-1");
      });
   });

   describe("getMySickStatusAction", () => {
      it("returns status for authenticated user", async () => {
         vi.mocked(requireSessionUser).mockResolvedValue({
            id: "user-1",
         } as any);
         vi.mocked(getUserSickStatus).mockResolvedValue({
            isSick: true,
            activatedAt: new Date(),
            note: null,
            reminderSnoozedUntil: null,
            lastDeactivatedAt: null,
         });

         const status = await getMySickStatusAction();
         expect(status?.isSick).toBe(true);
         expect(getUserSickStatus).toHaveBeenCalledWith("user-1");
      });

      it("returns null if unauthenticated", async () => {
         vi.mocked(requireSessionUser).mockRejectedValue(new Error("Auth"));
         const status = await getMySickStatusAction();
         expect(status).toBeNull();
      });
   });
});
