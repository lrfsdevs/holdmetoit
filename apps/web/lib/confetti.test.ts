// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
   triggerConfetti,
   triggerTaskConfetti,
   OBSIDIAN_CONFETTI_COLORS,
} from "./confetti";

describe("Confetti Engine (apps/web/lib/confetti.ts)", () => {
   beforeEach(() => {
      vi.restoreAllMocks();
   });

   afterEach(() => {
      // Clean up any stray canvas in document.body
      document.body.querySelectorAll("canvas").forEach((c) => c.remove());
   });

   it("exports Obsidian-themed colors palette matching design tokens", () => {
      expect(OBSIDIAN_CONFETTI_COLORS).toBeDefined();
      expect(OBSIDIAN_CONFETTI_COLORS.length).toBeGreaterThanOrEqual(6);
      expect(OBSIDIAN_CONFETTI_COLORS).toContain("#10b981"); // Emerald
      expect(OBSIDIAN_CONFETTI_COLORS).toContain("#fbbf24"); // Brand gold
   });

   it("executes triggerConfetti safely without throwing in headless jsdom environment", () => {
      expect(() => triggerConfetti()).not.toThrow();
   });

   it("executes triggerTaskConfetti with null or undefined safely", () => {
      expect(() => triggerTaskConfetti(null)).not.toThrow();
      expect(() => triggerTaskConfetti(undefined)).not.toThrow();
   });

   it("executes triggerTaskConfetti with MouseEvent coordinate target", () => {
      const fakeEvent = {
         clientX: 250,
         clientY: 400,
      } as unknown as MouseEvent;

      expect(() => triggerTaskConfetti(fakeEvent)).not.toThrow();
   });

   it("executes triggerTaskConfetti with an Element having getBoundingClientRect", () => {
      const fakeDiv = document.createElement("div");
      vi.spyOn(fakeDiv, "getBoundingClientRect").mockReturnValue({
         left: 100,
         top: 200,
         width: 300,
         height: 40,
         right: 400,
         bottom: 240,
         x: 100,
         y: 200,
         toJSON: () => {},
      });

      expect(() => triggerTaskConfetti(fakeDiv)).not.toThrow();
   });

   it("respects prefers-reduced-motion media query", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
         matches: query === "(prefers-reduced-motion: reduce)",
         media: query,
         onchange: null,
         addListener: vi.fn(),
         removeListener: vi.fn(),
         addEventListener: vi.fn(),
         removeEventListener: vi.fn(),
         dispatchEvent: vi.fn(),
      }));

      const createElementSpy = vi.spyOn(document, "createElement");
      triggerConfetti();
      expect(createElementSpy).not.toHaveBeenCalled();
   });

   it("creates fixed overlay canvas and runs animation when 2D context is supported", () => {
      const mockCtx = {
         scale: vi.fn(),
         clearRect: vi.fn(),
         save: vi.fn(),
         translate: vi.fn(),
         rotate: vi.fn(),
         globalAlpha: 1,
         fillStyle: "",
         fillRect: vi.fn(),
         beginPath: vi.fn(),
         arc: vi.fn(),
         fill: vi.fn(),
         restore: vi.fn(),
      };

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
         mockCtx as unknown as CanvasRenderingContext2D
      );

      triggerConfetti({
         particleCount: 5,
         origin: { x: 100, y: 100 },
         disableForReducedMotion: false,
      });

      const canvas = document.querySelector("canvas");
      expect(canvas).not.toBeNull();
      expect(canvas?.style.position).toBe("fixed");
      expect(canvas?.style.pointerEvents).toBe("none");
      expect(canvas?.style.zIndex).toBe("99999");
   });
});
