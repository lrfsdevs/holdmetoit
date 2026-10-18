import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   placeWagerAction,
   getChallengeWagersAction,
   getUserChallengeWagersAction,
} from "./wager.actions";
import * as wagerRepo from "../data/wager.repository";
import * as authSession from "@/features/auth/api/require-session";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("../data/wager.repository", () => ({
   placeWager: vi.fn(),
   getWagersForChallenge: vi.fn(),
   getUserWagersForChallenge: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("wager.actions", () => {
   const mockUser = {
      id: "usr_bet_1",
      username: "gambit",
      displayName: "Gambit",
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("placeWagerAction", () => {
      it("returns FEATURE_DISABLED when the betting system is off", async () => {
         vi.mocked(authSession.requireSessionUser).mockResolvedValue(
            mockUser as any
         );
         vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false);

         const result = await placeWagerAction({
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 100,
         });

         expect(result).toMatchObject({ ok: false, code: "FEATURE_DISABLED" });
         expect(wagerRepo.placeWager).not.toHaveBeenCalled();
      });

      it("rejects stake below minimum constraint (10 coins)", async () => {
         vi.mocked(authSession.requireSessionUser).mockResolvedValue(
            mockUser as any
         );

         const result = await placeWagerAction({
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 5,
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("INVALID_INPUT");
         expect(wagerRepo.placeWager).not.toHaveBeenCalled();
      });

      it("rejects stake above maximum constraint (1000 coins)", async () => {
         vi.mocked(authSession.requireSessionUser).mockResolvedValue(
            mockUser as any
         );

         const result = await placeWagerAction({
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 1500,
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("INVALID_INPUT");
         expect(wagerRepo.placeWager).not.toHaveBeenCalled();
      });

      it("successfully calls placeWager and returns wager details", async () => {
         vi.mocked(authSession.requireSessionUser).mockResolvedValue(
            mockUser as any
         );
         vi.mocked(wagerRepo.placeWager).mockResolvedValue({
            wager: {
               id: "wag_success",
               stake: 100,
               status: "ACCEPTED",
            } as any,
            isDuplicate: false,
         });

         const result = await placeWagerAction({
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 100,
         });

         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.wager?.id).toBe("wag_success");
            expect(result.isDuplicate).toBe(false);
         }
      });
   });

   describe("getChallengeWagersAction", () => {
      it("returns list of wagers", async () => {
         vi.mocked(wagerRepo.getWagersForChallenge).mockResolvedValue([
            { id: "wag_1", stake: 50 } as any,
         ]);

         const result = await getChallengeWagersAction("chal_1");
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.wagers).toHaveLength(1);
         }
      });
   });

   describe("getUserChallengeWagersAction", () => {
      it("returns current user's wagers", async () => {
         vi.mocked(authSession.requireSessionUser).mockResolvedValue(
            mockUser as any
         );
         vi.mocked(wagerRepo.getUserWagersForChallenge).mockResolvedValue([
            { id: "wag_user", stake: 100 } as any,
         ]);

         const result = await getUserChallengeWagersAction("chal_1");
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.wagers).toHaveLength(1);
         }
      });
   });
});
