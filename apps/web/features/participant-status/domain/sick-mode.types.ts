export interface SickModeDuration {
   elapsedHours: number;
   elapsedDays: number;
   formattedDuration: string;
}

export interface SickStatusSummary {
   isSick: boolean;
   activatedAt: Date | string | null;
   note: string | null;
   reminderSnoozedUntil?: Date | string | null;
   lastDeactivatedAt?: Date | string | null;
}

export interface SickStatusBadgeProps {
   isSick?: boolean;
   activatedAt?: Date | string | null;
   note?: string | null;
   variant?: "compact" | "default" | "prominent";
   className?: string;
   showTooltip?: boolean;
}

export interface SickReminderCheckInput {
   isSick: boolean;
   activatedAt: Date | string | null | undefined;
   reminderSnoozedUntil?: Date | string | null | undefined;
}

export interface SickAutoExpiryCheckInput {
   isSick: boolean;
   activatedAt: Date | string | null | undefined;
}
