// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   DEFAULT_USER_PREFERENCES,
   type UserPreferences,
} from "../domain/user-preferences";
import {
   USER_PREFERENCES_STORAGE_KEY,
   USER_PREFERENCES_UPDATED_EVENT,
   loadStoredPreferences,
   resetStoredPreferences,
   saveStoredPreferences,
   subscribeToPreferences,
} from "./preferences-storage";

describe("preferences-storage", () => {
   beforeEach(() => {
      window.localStorage.clear();
      resetStoredPreferences();
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("loads default preferences when localStorage is empty", () => {
      const prefs = loadStoredPreferences();
      expect(prefs.sound.todoCompletionSfx).toBe(false);
      expect(prefs.sound.volume).toBe(1.0);
   });

   it("persists and reloads updated preferences", () => {
      saveStoredPreferences((prev) => ({
         ...prev,
         sound: {
            ...prev.sound,
            todoCompletionSfx: true,
            volume: 0.7,
         },
      }));

      const loaded = loadStoredPreferences();
      expect(loaded.sound.todoCompletionSfx).toBe(true);
      expect(loaded.sound.volume).toBe(0.7);

      const raw = window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).sound.todoCompletionSfx).toBe(true);
   });

   it("resets preferences back to defaults", () => {
      saveStoredPreferences((prev) => ({
         ...prev,
         sound: {
            ...prev.sound,
            todoCompletionSfx: true,
         },
      }));
      expect(loadStoredPreferences().sound.todoCompletionSfx).toBe(true);

      resetStoredPreferences();
      expect(loadStoredPreferences().sound.todoCompletionSfx).toBe(false);
   });

   it("dispatches custom event and notifies subscribers upon update", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToPreferences(listener);

      saveStoredPreferences((prev) => ({
         ...prev,
         sound: {
            ...prev.sound,
            todoCompletionSfx: true,
         },
      }));

      expect(listener).toHaveBeenCalled();
      const lastCallArg =
         listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCallArg.sound.todoCompletionSfx).toBe(true);

      unsubscribe();
   });

   it("handles corrupted json in localStorage gracefully", () => {
      window.localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, "{ bad json !");
      const prefs = loadStoredPreferences();
      expect(prefs.sound.todoCompletionSfx).toBe(false);
   });

   it("retains unsaved memory fallback when localStorage.setItem throws", () => {
      const setItemSpy = vi
         .spyOn(window.localStorage, "setItem")
         .mockImplementation(() => {
            throw new Error("QuotaExceededError");
         });

      saveStoredPreferences((prev) => ({
         ...prev,
         sound: {
            ...prev.sound,
            todoCompletionSfx: true,
         },
      }));

      // Subsequent read should read memoryFallback rather than empty/stale localStorage
      const loaded = loadStoredPreferences();
      expect(loaded.sound.todoCompletionSfx).toBe(true);
      setItemSpy.mockRestore();
   });

   it("handles restricted localStorage getter without crashing", () => {
      const originalStorage = window.localStorage;
      Object.defineProperty(window, "localStorage", {
         configurable: true,
         get: () => {
            throw new Error("SecurityError: Access is denied");
         },
      });

      const prefs = loadStoredPreferences();
      expect(prefs.sound.todoCompletionSfx).toBe(false);

      // Restore
      Object.defineProperty(window, "localStorage", {
         configurable: true,
         value: originalStorage,
      });
   });
});
