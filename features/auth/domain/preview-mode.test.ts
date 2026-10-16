import { describe, expect, it } from "vitest";

import {
   getEffectiveAdminState,
   isParticipantPreviewEnabled,
} from "./preview-mode";

describe("isParticipantPreviewEnabled", () => {
   it("returns true for explicit truthy cookie values", () => {
      expect(isParticipantPreviewEnabled("true")).toBe(true);
      expect(isParticipantPreviewEnabled("1")).toBe(true);
   });

   it("returns false for falsy or unknown cookie values", () => {
      expect(isParticipantPreviewEnabled("false")).toBe(false);
      expect(isParticipantPreviewEnabled("0")).toBe(false);
      expect(isParticipantPreviewEnabled("")).toBe(false);
      expect(isParticipantPreviewEnabled(undefined)).toBe(false);
      expect(isParticipantPreviewEnabled(null)).toBe(false);
   });
});

describe("getEffectiveAdminState", () => {
   it("treats a regular participant as non-admin", () => {
      const state = getEffectiveAdminState({ userRole: "PARTICIPANT" });

      expect(state).toEqual({
         isActualAdmin: false,
         isPreviewActive: false,
         isAdmin: false,
         effectiveRole: "PARTICIPANT",
      });
   });

   it("keeps an admin in admin mode when no preview is requested", () => {
      const state = getEffectiveAdminState({ userRole: "ADMIN" });

      expect(state.isActualAdmin).toBe(true);
      expect(state.isPreviewActive).toBe(false);
      expect(state.isAdmin).toBe(true);
      expect(state.effectiveRole).toBe("ADMIN");
   });

   it("downgrades a DEV to participant when the preview cookie is set", () => {
      const state = getEffectiveAdminState({
         userRole: "DEV",
         previewCookie: "true",
      });

      expect(state.isActualAdmin).toBe(true);
      expect(state.isPreviewActive).toBe(true);
      expect(state.isAdmin).toBe(false);
      expect(state.effectiveRole).toBe("PARTICIPANT");
   });

   it("activates preview from the ?as=participant search param", () => {
      const state = getEffectiveAdminState({
         userRole: "ADMIN",
         searchParamAs: "participant",
      });

      expect(state.isPreviewActive).toBe(true);
      expect(state.isAdmin).toBe(false);
      expect(state.effectiveRole).toBe("PARTICIPANT");
   });

   it("ignores the preview cookie for non-admin roles", () => {
      const state = getEffectiveAdminState({
         userRole: "PARTICIPANT",
         previewCookie: "true",
      });

      expect(state.isActualAdmin).toBe(false);
      expect(state.isPreviewActive).toBe(false);
      expect(state.isAdmin).toBe(false);
      expect(state.effectiveRole).toBe("PARTICIPANT");
   });

   it("returns a null effective role for unauthenticated users", () => {
      const state = getEffectiveAdminState({ userRole: null });

      expect(state).toEqual({
         isActualAdmin: false,
         isPreviewActive: false,
         isAdmin: false,
         effectiveRole: null,
      });
   });
});
