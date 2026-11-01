import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChallengeSnapshotAction } from "./global-profile.actions";
import { auth } from "@/core/auth";
import * as privacyRepo from "../data/profile-privacy.repository";
import * as globalProfileRepo from "../data/global-profile.repository";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("../data/profile-privacy.repository", () => ({
   checkAreAcceptedFriends: vi.fn(),
}));

vi.mock("../data/global-profile.repository", () => ({
   getChallengeSnapshotForUser: vi.fn(),
}));

describe("getChallengeSnapshotAction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns BAD_REQUEST if targetUserId or challengeId is empty", async () => {
      const result1 = await getChallengeSnapshotAction("", "chal_1");
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("BAD_REQUEST");

      const result2 = await getChallengeSnapshotAction("user_1", "  ");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("BAD_REQUEST");
   });

   it("denies access with UNAUTHORIZED for unauthenticated spectator", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);
      vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(false);

      const result = await getChallengeSnapshotAction("user_target", "chal_1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.message).toContain(
         "only visible to friends and administrators"
      );
      expect(
         globalProfileRepo.getChallengeSnapshotForUser
      ).not.toHaveBeenCalled();
   });

   it("denies access with UNAUTHORIZED for non-friend participant", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_stranger", role: "PARTICIPANT" },
      } as any);
      vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(false);

      const result = await getChallengeSnapshotAction("user_target", "chal_1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNAUTHORIZED");
   });

   it("allows access for self", async () => {
      const mockSnapshot = { profile: { challengeTitle: "My Event" } } as any;
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_target", role: "PARTICIPANT" },
      } as any);
      vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(false);
      vi.mocked(
         globalProfileRepo.getChallengeSnapshotForUser
      ).mockResolvedValue(mockSnapshot);

      const result = await getChallengeSnapshotAction("user_target", "chal_1");

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockSnapshot);
      expect(
         globalProfileRepo.getChallengeSnapshotForUser
      ).toHaveBeenCalledWith(
         "user_target",
         "chal_1",
         expect.objectContaining({
            currentUserId: "user_target",
            isAdmin: false,
         })
      );
   });

   it("allows access for ADMIN viewer", async () => {
      const mockSnapshot = {
         profile: { challengeTitle: "Admin Event" },
      } as any;
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_admin", role: "ADMIN" },
      } as any);
      vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(false);
      vi.mocked(
         globalProfileRepo.getChallengeSnapshotForUser
      ).mockResolvedValue(mockSnapshot);

      const result = await getChallengeSnapshotAction("user_target", "chal_1");

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockSnapshot);
      expect(
         globalProfileRepo.getChallengeSnapshotForUser
      ).toHaveBeenCalledWith(
         "user_target",
         "chal_1",
         expect.objectContaining({
            currentUserId: "user_admin",
            isAdmin: true,
         })
      );
   });

   it("allows access for accepted friends (#145)", async () => {
      const mockSnapshot = {
         profile: { challengeTitle: "Friend Event" },
      } as any;
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_friend", role: "PARTICIPANT" },
      } as any);
      vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(true);
      vi.mocked(
         globalProfileRepo.getChallengeSnapshotForUser
      ).mockResolvedValue(mockSnapshot);

      const result = await getChallengeSnapshotAction("user_target", "chal_1");

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockSnapshot);
   });

   it("returns NOT_FOUND when challenge snapshot does not exist", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_target", role: "PARTICIPANT" },
      } as any);
      vi.mocked(
         globalProfileRepo.getChallengeSnapshotForUser
      ).mockResolvedValue(null);

      const result = await getChallengeSnapshotAction(
         "user_target",
         "chal_nonexistent"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
   });
});
