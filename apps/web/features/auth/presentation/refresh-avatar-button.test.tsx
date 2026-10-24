// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
} from "@testing-library/react";
import { RefreshAvatarButton } from "./refresh-avatar-button";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: mockRefresh,
   }),
}));

describe("RefreshAvatarButton", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   afterEach(() => {
      cleanup();
   });

   it("renders sync button", () => {
      render(<RefreshAvatarButton />);
      expect(screen.getByRole("button", { name: /sync avatar/i })).toBeTruthy();
   });

   it("calls /api/users/sync-avatar on click and triggers router.refresh", async () => {
      global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            newImageUrl: "https://cdn.discordapp.com/avatars/123/new.png",
         }),
      });

      const onSuccess = vi.fn();
      render(
         <RefreshAvatarButton
            userId="user_1"
            discordId="123"
            onSuccess={onSuccess}
         />
      );

      const btn = screen.getByRole("button", { name: /sync avatar/i });
      fireEvent.click(btn);

      await waitFor(() => {
         expect(global.fetch).toHaveBeenCalledWith(
            "/api/users/sync-avatar",
            expect.objectContaining({
               method: "POST",
               body: JSON.stringify({ userId: "user_1", discordId: "123" }),
            })
         );
         expect(onSuccess).toHaveBeenCalledWith(
            "https://cdn.discordapp.com/avatars/123/new.png"
         );
         expect(mockRefresh).toHaveBeenCalled();
         expect(screen.getByText("Avatar updated!")).toBeTruthy();
      });
   });

   it("displays warning when session expired and re-authentication is required", async () => {
      global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: false,
            requiresReauth: true,
            error: "Discord session expired — please log in again to sync",
         }),
      });

      render(<RefreshAvatarButton userId="user_expired" />);

      const btn = screen.getByRole("button", { name: /sync avatar/i });
      fireEvent.click(btn);

      await waitFor(() => {
         expect(
            screen.getByText(
               "Discord session expired — please log in again to sync"
            )
         ).toBeTruthy();
      });
   });

   it("displays friendly message when avatar is already up to date", async () => {
      global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            updated: false,
            message: "Avatar is up to date!",
            newImageUrl: "https://cdn.discordapp.com/avatars/123/same.png",
         }),
      });

      render(<RefreshAvatarButton userId="user_same" />);

      const btn = screen.getByRole("button", { name: /sync avatar/i });
      fireEvent.click(btn);

      await waitFor(() => {
         expect(screen.getByText("Avatar is up to date!")).toBeTruthy();
      });
   });
});
