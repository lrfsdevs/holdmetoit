export const DEVBOARD_TABS = ["flags", "ypt", "cron-logs"] as const;

export type DevBoardTab = (typeof DEVBOARD_TABS)[number];

export const DEFAULT_DEVBOARD_TAB: DevBoardTab = "flags";

/**
 * Resolves a `?tab=` value to a valid DevBoard section.
 * Repeated query params use the first value; invalid values fall back to
 * Feature Flags.
 */
export function resolveDevBoardTab(
   value?: string | string[] | null
): DevBoardTab {
   const candidate = Array.isArray(value) ? value[0] : value;

   return DEVBOARD_TABS.includes(candidate as DevBoardTab)
      ? (candidate as DevBoardTab)
      : DEFAULT_DEVBOARD_TAB;
}
