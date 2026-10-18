import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import DevBoardLayout from "./layout";
import { auth } from "@/core/auth";
import { cookies } from "next/headers";

vi.mock("next/navigation", () => ({
   redirect: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
   cookies: vi.fn(),
}));

vi.mock("@/features/auth/presentation/auth-nav", () => ({
   AppHeader: () => <div data-testid="app-header" />,
}));

describe("DevBoardLayout Guard", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.clearAllMocks();
      process.env = { ...originalEnv };
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn().mockReturnValue(undefined),
      } as any);
   });

   it("redirects unauthenticated users to / in production even if AUTH_DISCORD_ID is missing", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      delete process.env.AUTH_DISCORD_ID;
      vi.mocked(auth).mockResolvedValue(null as any);

      await DevBoardLayout({ children: <div>DevBoard Content</div> });

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("redirects ADMIN users to / because DevBoard is strictly DEV only", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_1", role: "ADMIN" },
      } as any);

      await DevBoardLayout({ children: <div>DevBoard Content</div> });

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("redirects DEV users to / when participant preview mode is active", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_1", role: "DEV" },
      } as any);
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn().mockImplementation((name: string) => {
            if (name === "holdmetoit_preview_as_participant") {
               return { value: "true" };
            }
            return undefined;
         }),
      } as any);

      await DevBoardLayout({ children: <div>DevBoard Content</div> });

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("renders children when user has DEV role in production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      process.env.AUTH_DISCORD_ID = "discord_123";
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_1", role: "DEV" },
      } as any);

      const result = await DevBoardLayout({
         children: <div>DevBoard Content</div>,
      });

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toBeDefined();
   });
});
