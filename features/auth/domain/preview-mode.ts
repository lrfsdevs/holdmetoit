import { hasAdminPrivileges, type UserRoleType } from "./auth-roles";

export const PARTICIPANT_PREVIEW_COOKIE = "holdmetoit_preview_as_participant";

export function isParticipantPreviewEnabled(
   cookieValue?: string | null
): boolean {
   return cookieValue === "true" || cookieValue === "1";
}

export interface EffectiveAdminState {
   isActualAdmin: boolean;
   isPreviewActive: boolean;
   isAdmin: boolean;
   effectiveRole: UserRoleType | string | null;
}

/**
 * Computes effective admin and preview status for a user based on their actual role,
 * the global preview cookie, and optional query parameters.
 */
export function getEffectiveAdminState({
   userRole,
   previewCookie,
   searchParamAs,
}: {
   userRole?: UserRoleType | string | null;
   previewCookie?: string | null;
   searchParamAs?: string | null;
}): EffectiveAdminState {
   const isActualAdmin = hasAdminPrivileges(userRole);
   const isPreviewRequested =
      isParticipantPreviewEnabled(previewCookie) ||
      searchParamAs === "participant";

   const isPreviewActive = isActualAdmin && isPreviewRequested;
   const isAdmin = isActualAdmin && !isPreviewActive;
   const effectiveRole = isPreviewActive ? "PARTICIPANT" : userRole || null;

   return {
      isActualAdmin,
      isPreviewActive,
      isAdmin,
      effectiveRole,
   };
}

/**
 * Returns true when a keyboard event matches the participant-preview shortcut
 * (Ctrl+P, or Cmd+P on macOS). No other modifier may be held.
 * Pure helper (Law L7) — no DOM/framework dependency.
 */
export function isParticipantPreviewHotkey(event: {
   code?: string;
   ctrlKey?: boolean;
   metaKey?: boolean;
   altKey?: boolean;
   shiftKey?: boolean;
}): boolean {
   return Boolean(
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.code === "KeyP"
   );
}
