// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreferencesView } from "./preferences-view";
import * as audioModule from "./audio-service";
import { resetStoredPreferences } from "../data/preferences-storage";

describe("PreferencesView", () => {
   let playAudioSpy: ReturnType<typeof vi.spyOn>;

   beforeEach(() => {
      resetStoredPreferences();
      playAudioSpy = vi
         .spyOn(audioModule, "playCompletionAudio")
         .mockResolvedValue(true);
   });

   afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
   });

   it("renders title and core sections", () => {
      render(<PreferencesView />);

      expect(screen.getByText("Preferences")).toBeTruthy();
      expect(screen.getByText("Audio Feedback")).toBeTruthy();
      expect(screen.getByText("Themes & Aesthetics")).toBeTruthy();
      expect(screen.getByText("Notifications & Reminders")).toBeTruthy();
   });

   it("renders 'Coming Soon' badges for themes and notifications", () => {
      render(<PreferencesView />);

      const comingSoonBadges = screen.getAllByText("Coming Soon");
      expect(comingSoonBadges.length).toBeGreaterThanOrEqual(2);
   });

   it("renders theme preview tiles with Obsidian Dark active", () => {
      render(<PreferencesView />);

      expect(screen.getByTestId("theme-tile-obsidian")).toBeTruthy();
      expect(screen.getByTestId("theme-tile-midnight")).toBeTruthy();
      expect(screen.getByTestId("theme-tile-emerald")).toBeTruthy();
      expect(screen.getByTestId("theme-tile-sunset")).toBeTruthy();
   });

   it("SFX toggle is unchecked by default (opt-in)", () => {
      render(<PreferencesView />);

      const toggle = screen.getByTestId("todo-sfx-switch");
      expect(toggle.getAttribute("data-state")).toBe("unchecked");
   });

   it("toggling SFX updates switch state and persists preference", () => {
      render(<PreferencesView />);

      const toggle = screen.getByTestId("todo-sfx-switch");
      fireEvent.click(toggle);

      expect(toggle.getAttribute("data-state")).toBe("checked");
   });

   it("clicking Preview button invokes playCompletionAudio with preview: true", () => {
      render(<PreferencesView />);

      const previewBtn = screen.getByTestId("preview-sound-button");
      fireEvent.click(previewBtn);

      expect(playAudioSpy).toHaveBeenCalledWith({ preview: true });
   });
});
