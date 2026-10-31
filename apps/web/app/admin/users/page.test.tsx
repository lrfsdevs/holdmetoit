import { describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./page";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { getAdminUserRoster } from "@/features/admin/data/user-directory.repository";

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
}));

vi.mock("@/features/admin/data/user-directory.repository", () => ({
   getAdminUserRoster: vi.fn(),
}));

vi.mock("@/features/admin/presentation/user-directory-view", () => ({
   UserDirectoryView: ({ initialData, currentAdminId }: any) => (
      <div data-testid="user-directory-view">
         <span>Admin: {currentAdminId}</span>
         <span>Users: {initialData?.items?.length}</span>
      </div>
   ),
}));

describe("AdminUsersPage", () => {
   it("gards with requireAdminUser and renders UserDirectoryView with initial data", async () => {
      vi.mocked(requireAdminUser).mockResolvedValue({
         id: "admin_test",
         username: "admin_user",
         displayName: "Admin",
         role: "ADMIN",
      });

      const mockData = {
         items: [{ id: "u1" }],
         totalCount: 1,
         page: 1,
         pageSize: 15,
         totalPages: 1,
         summary: {
            totalUsers: 1,
            activeEnrolledUsers: 1,
            unenrolledUsers: 0,
            yptConnectedUsers: 1,
         },
      };
      vi.mocked(getAdminUserRoster).mockResolvedValue(mockData as any);

      const page = await AdminUsersPage();
      expect(page).toBeDefined();
      expect(requireAdminUser).toHaveBeenCalled();
      expect(getAdminUserRoster).toHaveBeenCalledWith({
         page: 1,
         pageSize: 15,
      });
   });
});
