import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   activateSickMode,
   deactivateSickMode,
   getUserSickStatus,
   snoozeSickReminder,
} from "./sick-mode.repository";
import { prisma } from "@/core/db";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
         update: vi.fn(),
      },
   },
}));

describe("features/participant-status/data/sick-mode.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns null if user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);
      const res = await getUserSickStatus("missing-user");
      expect(res).toBeNull();
   });

   it("returns active sick status when not expired", async () => {
      const now = new Date("2026-11-01T12:00:00Z");
      const activatedAt = new Date("2026-10-31T12:00:00Z"); // 1 day ago
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         isSick: true,
         sickModeActivatedAt: activatedAt,
         sickModeNote: "Flu",
         sickModeReminderSnoozedUntil: null,
         sickModeLastDeactivatedAt: null,
      } as any);

      const res = await getUserSickStatus("user-1", now);
      expect(res).toEqual({
         isSick: true,
         activatedAt,
         note: "Flu",
         reminderSnoozedUntil: null,
         lastDeactivatedAt: null,
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
   });

   it("auto-expires and updates DB if activated 7 or more days ago", async () => {
      const now = new Date("2026-11-01T12:00:00Z");
      const activatedAt = new Date("2026-10-24T12:00:00Z"); // 8 days ago
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         isSick: true,
         sickModeActivatedAt: activatedAt,
         sickModeNote: "Old fever",
         sickModeReminderSnoozedUntil: null,
         sickModeLastDeactivatedAt: null,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const res = await getUserSickStatus("user-1", now);
      expect(res?.isSick).toBe(false);
      expect(res?.lastDeactivatedAt).toEqual(now);
      expect(prisma.user.update).toHaveBeenCalledWith({
         where: { id: "user-1" },
         data: {
            isSick: false,
            sickModeLastDeactivatedAt: now,
            sickModeReminderSnoozedUntil: null,
         },
      });
   });

   it("activates sick mode with note sanitization", async () => {
      const now = new Date("2026-11-01T12:00:00Z");
      vi.mocked(prisma.user.update).mockResolvedValue({
         isSick: true,
         sickModeActivatedAt: now,
         sickModeNote: "Severe migraine",
         sickModeReminderSnoozedUntil: null,
         sickModeLastDeactivatedAt: null,
      } as any);

      const res = await activateSickMode(
         "user-1",
         "  Severe  migraine \n ",
         now
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
         where: { id: "user-1" },
         data: {
            isSick: true,
            sickModeActivatedAt: now,
            sickModeNote: "Severe migraine",
            sickModeReminderSnoozedUntil: null,
         },
         select: expect.any(Object),
      });
      expect(res.isSick).toBe(true);
      expect(res.note).toBe("Severe migraine");
   });

   it("deactivates sick mode immediately", async () => {
      const now = new Date("2026-11-01T12:00:00Z");
      vi.mocked(prisma.user.update).mockResolvedValue({
         isSick: false,
         sickModeActivatedAt: new Date("2026-10-30T10:00:00Z"),
         sickModeNote: "Severe migraine",
         sickModeReminderSnoozedUntil: null,
         sickModeLastDeactivatedAt: now,
      } as any);

      const res = await deactivateSickMode("user-1", now);
      expect(prisma.user.update).toHaveBeenCalledWith({
         where: { id: "user-1" },
         data: {
            isSick: false,
            sickModeLastDeactivatedAt: now,
            sickModeReminderSnoozedUntil: null,
         },
         select: expect.any(Object),
      });
      expect(res.isSick).toBe(false);
      expect(res.lastDeactivatedAt).toEqual(now);
   });

   it("snoozes reminder by adding hours to current timestamp", async () => {
      const now = new Date("2026-11-01T12:00:00Z");
      const expectedSnooze = new Date(now.getTime() + 48 * 3600 * 1000);
      vi.mocked(prisma.user.update).mockResolvedValue({
         isSick: true,
         sickModeActivatedAt: new Date("2026-10-28T12:00:00Z"),
         sickModeNote: "Resting",
         sickModeReminderSnoozedUntil: expectedSnooze,
         sickModeLastDeactivatedAt: null,
      } as any);

      const res = await snoozeSickReminder("user-1", 48, now);
      expect(prisma.user.update).toHaveBeenCalledWith({
         where: { id: "user-1" },
         data: {
            sickModeReminderSnoozedUntil: expectedSnooze,
         },
         select: expect.any(Object),
      });
      expect(res.reminderSnoozedUntil).toEqual(expectedSnooze);
   });
});
