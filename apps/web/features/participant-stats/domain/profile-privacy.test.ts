import { describe, expect, it } from "vitest";
import { canViewFullProfileHistory } from "./profile-privacy";

describe("canViewFullProfileHistory", () => {
   const targetUserId = "user_scholar_1";

   it("rejects when targetUserId is missing or empty", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: "user_1",
            viewerRole: "PARTICIPANT",
            targetUserId: "",
         })
      ).toBe(false);

      expect(
         canViewFullProfileHistory({
            viewerId: "user_1",
            viewerRole: "ADMIN",
            targetUserId: "   ",
         })
      ).toBe(false);
   });

   it("allows self-access unconditionally", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: targetUserId,
            viewerRole: "PARTICIPANT",
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(true);
   });

   it("allows ADMIN and DEV roles unconditional access", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: "admin_user",
            viewerRole: "ADMIN",
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(true);

      expect(
         canViewFullProfileHistory({
            viewerId: "dev_user",
            viewerRole: "DEV",
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(true);
   });

   it("allows HOST role access", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: "host_user",
            viewerRole: "HOST",
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(true);
   });

   it("allows accepted friends full history access", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: "friend_user",
            viewerRole: "PARTICIPANT",
            targetUserId,
            isAcceptedFriend: true,
         })
      ).toBe(true);
   });

   it("denies access for ordinary unauthenticated spectators", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: null,
            viewerRole: null,
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(false);
   });

   it("denies access for non-friend authenticated participants", () => {
      expect(
         canViewFullProfileHistory({
            viewerId: "stranger_user",
            viewerRole: "PARTICIPANT",
            targetUserId,
            isAcceptedFriend: false,
         })
      ).toBe(false);
   });
});
