-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sickModeActivatedAt" TIMESTAMP(3),
ADD COLUMN "sickModeNote" VARCHAR(120),
ADD COLUMN "sickModeReminderSnoozedUntil" TIMESTAMP(3),
ADD COLUMN "sickModeLastDeactivatedAt" TIMESTAMP(3);
