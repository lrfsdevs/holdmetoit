import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/core/auth";
import { AdminAccessError, requireAdminUser } from "./require-admin";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

describe("require-admin", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns admin session user when role is ADMIN", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: {
            id: "admin_1",
            displayName: "ServerHost",
            role: "ADMIN",
         },
      } as never);

      const user = await requireAdminUser();
      expect(user.id).toBe("admin_1");
      expect(user.displayName).toBe("ServerHost");
      expect(user.role).toBe("ADMIN");
   });

   it("returns admin session user when role is DEV", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: {
            id: "dev_1",
            displayName: "CodeArchitect",
            role: "DEV",
         },
      } as never);

      const user = await requireAdminUser();
      expect(user.id).toBe("dev_1");
      expect(user.displayName).toBe("CodeArchitect");
      expect(user.role).toBe("DEV");
   });

   it("falls back to 'Developer' when role is DEV and displayName is missing", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: {
            id: "dev_2",
            role: "DEV",
         },
      } as never);

      const user = await requireAdminUser();
      expect(user.id).toBe("dev_2");
      expect(user.displayName).toBe("Developer");
      expect(user.role).toBe("DEV");
   });

   it("throws AdminAccessError when role is PARTICIPANT", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: {
            id: "student_1",
            role: "PARTICIPANT",
         },
      } as never);

      await expect(requireAdminUser()).rejects.toThrow(AdminAccessError);
   });

   it("throws AdminAccessError when session is missing", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      await expect(requireAdminUser()).rejects.toThrow(AdminAccessError);
   });
});
