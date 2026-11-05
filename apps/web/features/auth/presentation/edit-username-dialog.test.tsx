// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { EditUsernameDialog } from "./edit-username-dialog";
import * as usernameActions from "@/features/auth/api/username.actions";

vi.mock("@/features/auth/api/username.actions", () => ({
   checkUsernameAvailabilityAction: vi.fn(),
   updateUsernameAction: vi.fn(),
}));

vi.mock("sonner", () => ({
   toast: {
      success: vi.fn(),
      error: vi.fn(),
   },
}));

afterEach(cleanup);

describe("EditUsernameDialog", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders default pencil trigger button", () => {
      render(<EditUsernameDialog currentUsername="Alice" />);
      const trigger = screen.getByTestId("edit-username-trigger");
      expect(trigger).toBeDefined();
   });

   it("opens dialog on trigger click and shows current username", () => {
      render(<EditUsernameDialog currentUsername="Alice" />);
      const trigger = screen.getByTestId("edit-username-trigger");
      fireEvent.click(trigger);

      expect(screen.getByText("Edit Platform Username")).toBeDefined();
      const input = screen.getByTestId("platform-username-input") as HTMLInputElement;
      expect(input.value).toBe("Alice");
   });

   it("displays active cooldown warning when changed within 7 days", () => {
      // Changed 2 days ago
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      render(
         <EditUsernameDialog
            currentUsername="Alice"
            usernameChangedAt={twoDaysAgo}
         />
      );

      const trigger = screen.getByTestId("edit-username-trigger");
      fireEvent.click(trigger);

      expect(screen.getByTestId("cooldown-notice")).toBeDefined();
      const input = screen.getByTestId("platform-username-input") as HTMLInputElement;
      expect(input.disabled).toBe(true);

      const saveBtn = screen.getByTestId("save-username-btn") as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
   });

   it("checks username availability on change and displays reason when taken", async () => {
      vi.mocked(usernameActions.checkUsernameAvailabilityAction).mockResolvedValue({
         ok: true,
         data: {
            available: false,
            candidate: "TakenUser",
            canonical: "takenuser",
            reason: "This username is already taken.",
         },
      });

      render(<EditUsernameDialog currentUsername="Alice" />);
      fireEvent.click(screen.getByTestId("edit-username-trigger"));

      const input = screen.getByTestId("platform-username-input");
      fireEvent.change(input, { target: { value: "TakenUser" } });

      await waitFor(() => {
         expect(
            usernameActions.checkUsernameAvailabilityAction
         ).toHaveBeenCalledWith("TakenUser");
      });

      await waitFor(() => {
         expect(screen.getByTestId("username-check-error").textContent).toContain(
            "This username is already taken."
         );
      });
   });

   it("submits updateUsernameAction and triggers onUsernameUpdated callback", async () => {
      vi.mocked(usernameActions.checkUsernameAvailabilityAction).mockResolvedValue({
         ok: true,
         data: {
            available: true,
            candidate: "NewHandle",
            canonical: "newhandle",
         },
      });

      vi.mocked(usernameActions.updateUsernameAction).mockResolvedValue({
         ok: true,
         data: {
            username: "NewHandle",
            usernameChangedAt: new Date().toISOString(),
         },
      });

      const onUpdate = vi.fn();

      render(
         <EditUsernameDialog
            currentUsername="Alice"
            onUsernameUpdated={onUpdate}
         />
      );

      fireEvent.click(screen.getByTestId("edit-username-trigger"));

      const input = screen.getByTestId("platform-username-input");
      fireEvent.change(input, { target: { value: "NewHandle" } });

      await waitFor(() => {
         const saveBtn = screen.getByTestId("save-username-btn") as HTMLButtonElement;
         expect(saveBtn.disabled).toBe(false);
      });

      fireEvent.click(screen.getByTestId("save-username-btn"));

      await waitFor(() => {
         expect(usernameActions.updateUsernameAction).toHaveBeenCalledWith(
            "NewHandle"
         );
         expect(onUpdate).toHaveBeenCalledWith("NewHandle");
      });
   });
});
