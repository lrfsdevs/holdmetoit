// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioSettingsCard } from "./audio-settings-card";
import * as audioModule from "./audio-service";
import { resetStoredPreferences } from "../data/preferences-storage";

describe("AudioSettingsCard", () => {
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

   it("renders title, description, and default muted badge", () => {
      render(<AudioSettingsCard />);

      expect(screen.getByText("Audio Feedback")).toBeTruthy();
      expect(screen.getByText("Muted by Default")).toBeTruthy();
      expect(
         screen.getByText('Task Completion Sound ("Yippee!")')
      ).toBeTruthy();
   });

   it("SFX toggle is unchecked by default (opt-in requirement)", () => {
      render(<AudioSettingsCard />);

      const toggle = screen.getByTestId("todo-sfx-switch");
      expect(toggle.getAttribute("data-state")).toBe("unchecked");
   });

   it("toggling SFX updates switch state to checked and badge to Enabled", () => {
      render(<AudioSettingsCard />);

      const toggle = screen.getByTestId("todo-sfx-switch");
      fireEvent.click(toggle);

      expect(toggle.getAttribute("data-state")).toBe("checked");
      expect(screen.getByText("Enabled")).toBeTruthy();
   });

   it("clicking Preview button invokes playCompletionAudio with preview: true", () => {
      render(<AudioSettingsCard />);

      const previewBtn = screen.getByTestId("preview-sound-button");
      fireEvent.click(previewBtn);

      expect(playAudioSpy).toHaveBeenCalledWith({ preview: true });
   });
});
