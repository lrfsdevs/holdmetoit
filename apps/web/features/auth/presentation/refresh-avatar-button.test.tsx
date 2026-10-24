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
});
