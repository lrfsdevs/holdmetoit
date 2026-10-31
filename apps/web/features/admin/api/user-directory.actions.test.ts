import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   fetchAdminUserRosterAction,
   updateUserRoleAction,
   getUserAuditLogsAction,
} from "./user-directory.actions";
import { prisma } from "@/core/db";
import {
   requireAdminUser,
   AdminAccessError,
} from "@/features/auth/api/require-admin";
import {
   recordAuditEvent,
   getUserAuditTrail,
} from "@/features/audit/data/audit-log.repository";
import { getAdminUserRoster } from "../data/user-directory.repository";
import { revalidatePath } from "next/cache";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
         update: vi.fn(),
      },
   },
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
   AdminAccessError: class AdminAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_ADMIN";
      constructor(message = "Host administrative permissions required.") {
         super(message);
         this.name = "AdminAccessError";
      }
   },
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn(),
   getUserAuditTrail: vi.fn(),
}));

vi.mock("../data/user-directory.repository", () => ({
   getAdminUserRoster: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("user-directory.actions", () => {
   const mockAdmin = {
      id: "admin_1",
      username: "admin_user",
      displayName: "Admin User",
      role: "ADMIN" as const,
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("fetchAdminUserRosterAction", () => {
      it("returns FORBIDDEN error when caller is not admin", async () => {
         vi.mocked(requireAdminUser).mockRejectedValue(new AdminAccessError());

         const result = await fetchAdminUserRosterAction();
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FORBIDDEN");
         }
      });

      it("returns roster result when caller is admin", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);
         const mockRosterResult = {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 10,
            totalPages: 1,
            summary: {
               totalUsers: 0,
               activeEnrolledUsers: 0,
               unenrolledUsers: 0,
               yptConnectedUsers: 0,
            },
         };
         vi.mocked(getAdminUserRoster).mockResolvedValue(mockRosterResult);

         const result = await fetchAdminUserRosterAction({ search: "alice" });
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data).toEqual(mockRosterResult);
         }
         expect(getAdminUserRoster).toHaveBeenCalledWith({ search: "alice" });
      });
   });

   describe("updateUserRoleAction", () => {
      it("returns FORBIDDEN error when caller is not admin", async () => {
         vi.mocked(requireAdminUser).mockRejectedValue(new AdminAccessError());

         const result = await updateUserRoleAction({
            targetUserId: "user_2",
            newRole: "ADMIN",
            reason: "Promoting to admin",
         });
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FORBIDDEN");
         }
      });

      it("returns validation error on invalid input", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);

         const result = await updateUserRoleAction({
            targetUserId: "",
            newRole: "INVALID_ROLE" as any,
            reason: "no",
         });
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("VALIDATION_ERROR");
         }
      });

      it("guards against self-demotion when actor targets self with non-ADMIN role", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);

         // Self target with USER role
         const resultUser = await updateUserRoleAction({
            targetUserId: "admin_1",
            newRole: "USER",
            reason: "Demoting myself",
         });
         expect(resultUser.ok).toBe(false);
         if (!resultUser.ok) {
            expect(resultUser.code).toBe("SELF_DEMOTION_FORBIDDEN");
         }

         // Self target with HOST role
         const resultHost = await updateUserRoleAction({
            targetUserId: "admin_1",
            newRole: "HOST",
            reason: "Switching to host",
         });
         expect(resultHost.ok).toBe(false);
         if (!resultHost.ok) {
            expect(resultHost.code).toBe("SELF_DEMOTION_FORBIDDEN");
         }
         expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it("returns USER_NOT_FOUND if target user does not exist", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);
         vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

         const result = await updateUserRoleAction({
            targetUserId: "nonexistent_user",
            newRole: "HOST",
            reason: "Promoting user",
         });
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("USER_NOT_FOUND");
         }
      });

      it("updates role to PARTICIPANT when newRole is USER and records audit log", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_2",
            role: "ADMIN",
            displayName: "Bob Smith",
            name: "Bob",
            username: "bob_tag",
         } as any);

         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_2",
            role: "PARTICIPANT",
         } as any);

         const result = await updateUserRoleAction({
            targetUserId: "user_2",
            newRole: "USER",
            reason: "Demoting to participant per policy",
         });

         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data).toEqual({
               userId: "user_2",
               newRole: "USER",
               dbRole: "PARTICIPANT",
            });
         }

         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_2" },
            data: { role: "PARTICIPANT" },
         });

         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actorId: "admin_1",
               actionType: "USER_ROLE_UPDATED",
               targetEntityId: "user_2",
               targetEntityType: "USER",
               targetEntityName: "Bob Smith",
               previousValue: { role: "ADMIN" },
               newValue: { role: "PARTICIPANT", rosterRole: "USER" },
               auditReason: "Demoting to participant per policy",
            })
         );

         expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
         expect(revalidatePath).toHaveBeenCalledWith("/admin");
         expect(revalidatePath).toHaveBeenCalledWith("/profile/user_2");
      });

      it("updates role to ADMIN when newRole is HOST or ADMIN", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_3",
            role: "PARTICIPANT",
            displayName: "Charlie",
            name: "Charlie",
            username: "charlie_tag",
         } as any);

         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_3",
            role: "ADMIN",
         } as any);

         const result = await updateUserRoleAction({
            targetUserId: "user_3",
            newRole: "HOST",
            reason: "Promoting to host for new challenge",
         });

         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.dbRole).toBe("ADMIN");
         }

         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_3" },
            data: { role: "ADMIN" },
         });
      });
   });

   describe("getUserAuditLogsAction", () => {
      it("returns FORBIDDEN error when caller is not admin", async () => {
         vi.mocked(requireAdminUser).mockRejectedValue(new AdminAccessError());

         const result = await getUserAuditLogsAction({ targetUserId: "u1" });
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FORBIDDEN");
         }
      });

      it("returns validation error when targetUserId is empty", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);

         const result = await getUserAuditLogsAction({ targetUserId: "   " });
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("VALIDATION_ERROR");
         }
      });

      it("fetches audit logs when caller is admin", async () => {
         vi.mocked(requireAdminUser).mockResolvedValue(mockAdmin);
         const mockLogs = [
            {
               id: "audit_1",
               timestamp: new Date().toISOString(),
               actorId: "admin_1",
               actorUsername: "admin_user",
               actionType: "USER_ROLE_UPDATED" as const,
               targetEntityId: "u1",
               targetEntityType: "USER" as const,
               previousValue: null,
               newValue: null,
               auditReason: "Test audit",
            },
         ];
         vi.mocked(getUserAuditTrail).mockResolvedValue(mockLogs as any);

         const result = await getUserAuditLogsAction({
            targetUserId: "u1",
            limit: 10,
         });
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data).toEqual(mockLogs);
         }
         expect(getUserAuditTrail).toHaveBeenCalledWith("u1", 10);
      });
   });
});
