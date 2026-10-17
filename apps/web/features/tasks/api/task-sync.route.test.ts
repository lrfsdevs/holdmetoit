import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/tasks/sync/route";
import { AuthError } from "@/features/auth/api/require-session";
import * as sessionModule from "@/features/auth/api/require-session";
import * as syncRepo from "@/features/tasks/data/task-sync.repository";

vi.mock("next/cache", () => ({
   revalidateTag: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {},
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/tasks/data/task-sync.repository", () => ({
   processBatchSync: vi.fn(),
}));

describe("POST /api/tasks/sync route handler", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns 401 if user is unauthenticated", async () => {
      vi.mocked(sessionModule.requireSessionUser).mockRejectedValue(
         new AuthError("Unauthorized")
      );

      const req = new Request("http://localhost/api/tasks/sync", {
         method: "POST",
         body: JSON.stringify({ mutations: [] }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
   });

   it("returns 400 if payload is invalid", async () => {
      vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
         id: "user_123",
      } as never);

      const req = new Request("http://localhost/api/tasks/sync", {
         method: "POST",
         body: JSON.stringify({
            mutations: [
               {
                  id: "not-a-valid-uuid",
                  entityType: "INVALID",
                  action: "UNKNOWN",
               },
            ],
         }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
   });

   it("processes mutations and returns 200 with server changes", async () => {
      vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
         id: "user_123",
      } as never);

      const mutationId = "11111111-1111-4111-8111-111111111111";

      vi.mocked(syncRepo.processBatchSync).mockResolvedValue({
         success: true,
         processedMutationIds: [mutationId],
         serverChanges: {
            categories: [],
            tasks: [],
         },
      });

      const req = new Request("http://localhost/api/tasks/sync", {
         method: "POST",
         body: JSON.stringify({
            mutations: [
               {
                  id: mutationId,
                  entityType: "TASK",
                  action: "CREATE",
                  payload: {
                     id: "22222222-2222-4222-8222-222222222222",
                     title: "Physics Problem Set",
                     taskType: "DAILY",
                  },
                  createdAt: 1728189600000,
                  retryCount: 0,
               },
            ],
         }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.processedMutationIds).toContain(mutationId);
      expect(syncRepo.processBatchSync).toHaveBeenCalledWith(
         "user_123",
         expect.any(Array)
      );
   });
});
