// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
} from "@testing-library/react";

import { EditDuoTeamModal } from "./edit-duo-team-modal";
import { updateDuoTeamIdentityAction } from "@/features/challenges/api/update-duo-team-identity.actions";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
   useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/features/challenges/api/update-duo-team-identity.actions", () => ({
   updateDuoTeamIdentityAction: vi.fn(),
}));

afterEach(cleanup);

function renderModal(overrides: Record<string, unknown> = {}) {
   return render(
      <EditDuoTeamModal
         challengeId="chal-1"
         currentName="Ember Foxes"
         currentEmoji="🔥"
         isOpen
         onOpenChange={vi.fn()}
         {...overrides}
      />
   );
}

describe("EditDuoTeamModal", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(updateDuoTeamIdentityAction).mockResolvedValue({ ok: true });
   });

   it("renders the current name, emoji, preview, and preset palette", () => {
      renderModal();

      expect(
         (screen.getByTestId("duo-team-name-input") as HTMLInputElement).value
      ).toBe("Ember Foxes");
      expect(
         (screen.getByTestId("duo-team-emoji-input") as HTMLInputElement).value
      ).toBe("🔥");
      expect(screen.getByText("Edit your duo")).toBeTruthy();
      expect(screen.getByTestId("duo-emoji-preset-🦊")).toBeTruthy();
      expect(screen.getByTestId("duo-emoji-preset-🦉")).toBeTruthy();
   });

   it("applies a preset emoji and saves both fields", async () => {
      renderModal();

      fireEvent.click(screen.getByTestId("duo-emoji-preset-🦊"));
      expect(
         (screen.getByTestId("duo-team-emoji-input") as HTMLInputElement).value
      ).toBe("🦊");

      fireEvent.click(screen.getByTestId("duo-team-identity-submit"));

      await waitFor(() =>
         expect(updateDuoTeamIdentityAction).toHaveBeenCalledWith({
            challengeId: "chal-1",
            name: "Ember Foxes",
            iconEmoji: "🦊",
         })
      );
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
   });

   it("clears the emoji and submits null", async () => {
      renderModal();

      fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
      expect(
         (screen.getByTestId("duo-team-emoji-input") as HTMLInputElement).value
      ).toBe("");

      fireEvent.click(screen.getByTestId("duo-team-identity-submit"));

      await waitFor(() =>
         expect(updateDuoTeamIdentityAction).toHaveBeenCalledWith(
            expect.objectContaining({ iconEmoji: null })
         )
      );
   });

   it("rejects multiple emoji client-side without calling the action", async () => {
      renderModal();

      fireEvent.change(screen.getByTestId("duo-team-emoji-input"), {
         target: { value: "🐝🐝" },
      });
      fireEvent.click(screen.getByTestId("duo-team-identity-submit"));

      expect(
         (await screen.findByTestId("duo-team-identity-error")).textContent
      ).toContain("Please pick a single emoji.");
      expect(updateDuoTeamIdentityAction).not.toHaveBeenCalled();
   });

   it("disables submit when the name is empty", () => {
      renderModal();

      fireEvent.change(screen.getByTestId("duo-team-name-input"), {
         target: { value: "   " },
      });

      expect(
         (screen.getByTestId("duo-team-identity-submit") as HTMLButtonElement)
            .disabled
      ).toBe(true);
   });

   it("shows a server error and keeps the dialog open", async () => {
      vi.mocked(updateDuoTeamIdentityAction).mockResolvedValue({
         ok: false,
         code: "RESULTS_LOCKED",
         message: "Duo identities are locked after results are finalized.",
      });

      renderModal();
      fireEvent.click(screen.getByTestId("duo-team-identity-submit"));

      expect(
         (await screen.findByTestId("duo-team-identity-error")).textContent
      ).toContain("Duo identities are locked after results are finalized.");
      expect(refreshMock).not.toHaveBeenCalled();
   });
});
