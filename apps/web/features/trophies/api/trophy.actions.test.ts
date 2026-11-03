import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   adminAdjustTrophiesAction,
   getTrophyLeaderboardAction,
   getUserCompetitiveStatsAction,
   getUserTrophyHistoryAction,
} from "./trophy.actions";
import * as trophyRepo from "../data/trophy.repository";
import * as authSession from "@/features/auth/api/require-session";
import * as authAdmin from "@/features/auth/api/require-admin";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("../data/trophy.repository", () => ({
   getTrophyLeaderboard: vi.fn(),
   getTrophyHistory: vi.fn(),
   getUserCompetitiveStats: vi.fn(),
   adminAdjustTrophies: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
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

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("trophy.actions", () => {
   const mockAdmin = {
      id: "adm_1",
      username: "adminUser",
      displayName: "Admin",
      role: "ADMIN" as const,
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("getTrophyLeaderboardAction", () => {
      it("returns leaderboard data successfully", async () => {
         vi.mocked(trophyRepo.getTrophyLeaderboard).mockResolvedValue({
            entries: [{ id: "usr_1", trophies: 1200 }] as any,
            pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
         });

         const result = await getTrophyLeaderboardAction();
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.entries).toHaveLength(1);
         }
      });

      it("masks raw database error with sanitized message", async () => {
         vi.mocked(trophyRepo.getTrophyLeaderboard).mockRejectedValueOnce(
            new Error("FATAL: connection pool exhausted at postgres://db:5432")
         );

         const result = await getTrophyLeaderboardAction();
         expect(result.ok).toBe(false);
         expect(result.code).toBe("LEADERBOARD_FETCH_FAILED");
         expect(result.message).toBe("Failed to fetch trophy leaderboard.");
         expect(result.message).not.toContain("connection pool");
         expect(result.message).not.toContain("postgres://");
      });
   });

   describe("adminAdjustTrophiesAction", () => {
      it("preserves actionable message for AdminAccessError domain check", async () => {
         vi.mocked(authAdmin.requireAdminUser).mockRejectedValueOnce(
            new authAdmin.AdminAccessError()
         );

         const result = await adminAdjustTrophiesAction({
            userId: "usr_target",
            amount: 50,
            reason: "Tournament victory bonus",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("FORBIDDEN_NOT_ADMIN");
         expect(result.message).toBe(
            "Host administrative permissions required."
         );
      });

      it("masks raw database error with sanitized message", async () => {
         vi.mocked(authAdmin.requireAdminUser).mockResolvedValue(mockAdmin);
         vi.mocked(trophyRepo.adminAdjustTrophies).mockRejectedValueOnce(
            new Error("deadlock detected on table TrophyTransaction")
         );

         const result = await adminAdjustTrophiesAction({
            userId: "usr_target",
            amount: 50,
            reason: "Tournament victory bonus",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("ADJUSTMENT_FAILED");
         expect(result.message).toBe("Failed to adjust user trophies.");
         expect(result.message).not.toContain("deadlock");
         expect(result.message).not.toContain("TrophyTransaction");
      });
   });
});
