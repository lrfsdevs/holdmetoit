import { prisma } from "@/core/db";
import {
   isSickModeAutoExpired,
   sanitizeSickModeNote,
   SICK_MODE_REMINDER_SNOOZE_HOURS,
} from "../domain/sick-mode";
import type { SickStatusSummary } from "../domain/sick-mode.types";

/**
 * Retrieves the current Sick Mode status for a user, enforcing the 7-day auto-expiry safeguard.
 */
export async function getUserSickStatus(
   userId: string,
   now: Date = new Date()
): Promise<SickStatusSummary | null> {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         isSick: true,
         sickModeActivatedAt: true,
         sickModeNote: true,
         sickModeReminderSnoozedUntil: true,
         sickModeLastDeactivatedAt: true,
      },
   });

   if (!user) return null;

   // Check auto-expiry safeguard (7 consecutive days)
   if (
      user.isSick &&
      user.sickModeActivatedAt &&
      isSickModeAutoExpired(
         {
            isSick: user.isSick,
            activatedAt: user.sickModeActivatedAt,
         },
         now
      )
   ) {
      await prisma.user.update({
         where: { id: userId },
         data: {
            isSick: false,
            sickModeLastDeactivatedAt: now,
            sickModeReminderSnoozedUntil: null,
         },
      });

      return {
         isSick: false,
         activatedAt: user.sickModeActivatedAt,
         note: user.sickModeNote,
         reminderSnoozedUntil: null,
         lastDeactivatedAt: now,
      };
   }

   return {
      isSick: user.isSick,
      activatedAt: user.sickModeActivatedAt,
      note: user.sickModeNote,
      reminderSnoozedUntil: user.sickModeReminderSnoozedUntil,
      lastDeactivatedAt: user.sickModeLastDeactivatedAt,
   };
}

/**
 * Activates Sick Mode for a participant with an optional note.
 */
export async function activateSickMode(
   userId: string,
   note?: string | null,
   now: Date = new Date()
): Promise<SickStatusSummary> {
   const sanitizedNote = sanitizeSickModeNote(note);

   const updated = await prisma.user.update({
      where: { id: userId },
      data: {
         isSick: true,
         sickModeActivatedAt: now,
         sickModeNote: sanitizedNote,
         sickModeReminderSnoozedUntil: null,
      },
      select: {
         isSick: true,
         sickModeActivatedAt: true,
         sickModeNote: true,
         sickModeReminderSnoozedUntil: true,
         sickModeLastDeactivatedAt: true,
      },
   });

   return {
      isSick: updated.isSick,
      activatedAt: updated.sickModeActivatedAt,
      note: updated.sickModeNote,
      reminderSnoozedUntil: updated.sickModeReminderSnoozedUntil,
      lastDeactivatedAt: updated.sickModeLastDeactivatedAt,
   };
}

/**
 * Deactivates Sick Mode immediately for a participant.
 */
export async function deactivateSickMode(
   userId: string,
   now: Date = new Date()
): Promise<SickStatusSummary> {
   const updated = await prisma.user.update({
      where: { id: userId },
      data: {
         isSick: false,
         sickModeLastDeactivatedAt: now,
         sickModeReminderSnoozedUntil: null,
      },
      select: {
         isSick: true,
         sickModeActivatedAt: true,
         sickModeNote: true,
         sickModeReminderSnoozedUntil: true,
         sickModeLastDeactivatedAt: true,
      },
   });

   return {
      isSick: updated.isSick,
      activatedAt: updated.sickModeActivatedAt,
      note: updated.sickModeNote,
      reminderSnoozedUntil: updated.sickModeReminderSnoozedUntil,
      lastDeactivatedAt: updated.sickModeLastDeactivatedAt,
   };
}

/**
 * Snoozes the 3-day reminder check-in by extending it by +2 days (48 hours).
 */
export async function snoozeSickReminder(
   userId: string,
   snoozeHours: number = SICK_MODE_REMINDER_SNOOZE_HOURS,
   now: Date = new Date()
): Promise<SickStatusSummary> {
   const snoozedUntil = new Date(now.getTime() + snoozeHours * 3600 * 1000);

   const updated = await prisma.user.update({
      where: { id: userId },
      data: {
         sickModeReminderSnoozedUntil: snoozedUntil,
      },
      select: {
         isSick: true,
         sickModeActivatedAt: true,
         sickModeNote: true,
         sickModeReminderSnoozedUntil: true,
         sickModeLastDeactivatedAt: true,
      },
   });

   return {
      isSick: updated.isSick,
      activatedAt: updated.sickModeActivatedAt,
      note: updated.sickModeNote,
      reminderSnoozedUntil: updated.sickModeReminderSnoozedUntil,
      lastDeactivatedAt: updated.sickModeLastDeactivatedAt,
   };
}
