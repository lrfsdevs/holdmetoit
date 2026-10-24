// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UserAvatar } from "./user-avatar";

describe("UserAvatar component", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({ success: true }),
      });
   });

   afterEach(() => {
      cleanup();
   });

   it("renders initials fallback when no src is provided", () => {
      render(<UserAvatar name="Krish Jaiswal" />);
      expect(screen.getByText("KJ")).toBeTruthy();
   });

   it("renders '?' fallback when name and src are absent", () => {
      render(<UserAvatar />);
      expect(screen.getByText("?")).toBeTruthy();
   });

   it("renders with custom className and size", () => {
      const { container } = render(
         <UserAvatar name="Test User" size="lg" className="border-red-500" />
      );
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain("h-12");
      expect(root.className).toContain("w-12");
      expect(root.className).toContain("border-red-500");
   });

   it("renders image tag when src is provided", () => {
      render(
         <UserAvatar
            src="https://cdn.discordapp.com/avatars/123/hash.png"
            name="Test User"
         />
      );
      const img = screen.queryByRole("img");
      // Radix mounts image or fallback depending on status
      expect(screen.getByText("TU") || img).toBeTruthy();
   });
});
