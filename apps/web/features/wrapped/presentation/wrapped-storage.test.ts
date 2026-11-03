// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
   getWrappedMascotPreference,
   setWrappedMascotPreference,
   useWrappedMascotPreference,
   WRAPPED_MASCOT_CHANGE_EVENT,
   WRAPPED_MASCOT_STORAGE_KEY,
} from "./wrapped-storage";

describe("wrapped-storage (Mascot Persistence)", () => {
   beforeEach(() => {
      window.localStorage.clear();
      setWrappedMascotPreference("GOOGLY_EYES");
   });

   it("defaults to GOOGLY_EYES when storage is empty", () => {
      expect(getWrappedMascotPreference()).toBe("GOOGLY_EYES");
   });

   it("persists chosen variant to localStorage and updates getter", () => {
      setWrappedMascotPreference("CAT");
      expect(window.localStorage.getItem(WRAPPED_MASCOT_STORAGE_KEY)).toBe(
         "CAT"
      );
      expect(getWrappedMascotPreference()).toBe("CAT");

      setWrappedMascotPreference("DOG");
      expect(getWrappedMascotPreference()).toBe("DOG");

      setWrappedMascotPreference("BUNNY");
      expect(getWrappedMascotPreference()).toBe("BUNNY");
   });

   it("dispatches custom window event on preference change", () => {
      const listener = vi.fn();
      window.addEventListener(WRAPPED_MASCOT_CHANGE_EVENT, listener);

      setWrappedMascotPreference("BUNNY");

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toBe("BUNNY");

      window.removeEventListener(WRAPPED_MASCOT_CHANGE_EVENT, listener);
   });

   it("useWrappedMascotPreference hook reacts to setVariant calls", () => {
      const { result } = renderHook(() => useWrappedMascotPreference());
      expect(result.current.variant).toBe("GOOGLY_EYES");

      act(() => {
         result.current.setVariant("CAT");
      });

      expect(result.current.variant).toBe("CAT");
      expect(getWrappedMascotPreference()).toBe("CAT");
   });

   it("useWrappedMascotPreference honors overrideVariant prop", () => {
      const { result } = renderHook(() => useWrappedMascotPreference("DOG"));
      expect(result.current.variant).toBe("DOG");
   });
});
