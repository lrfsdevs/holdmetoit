import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import * as discordService from "./discord-guild.service";
import {
   findUserByDiscordId,
   findUserById,
   findUserByUsername,
   isUsernameAvailable,
   provisionInitialUsername,
   syncUserFromDiscordProfile,
   syncUserRoleFromDiscord,
   updateUsername,
   UsernameTakenError,
} from "./user.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      $queryRaw: vi.fn(),
      user: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         update: vi.fn(),
         findMany: vi.fn(),
      },
   },
}));

vi.mock("./discord-guild.service", () => ({
   isDiscordAdmin: vi.fn(),
   isDiscordDev: vi.fn(),
}));

describe("user.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("syncUserRoleFromDiscord", () => {
      it("assigns DEV role when isDiscordDev is true", async () => {
         vi.mocked(discordService.isDiscordDev).mockReturnValue(true);
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_1",
            role: "DEV",
         } as never);

         const role = await syncUserRoleFromDiscord("user_1", "dev_snowflake");

         expect(role).toBe("DEV");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { role: "DEV" },
         });
         expect(discordService.isDiscordAdmin).not.toHaveBeenCalled();
      });

      it("assigns ADMIN role when isDiscordDev is false and isDiscordAdmin is true", async () => {
         vi.mocked(discordService.isDiscordDev).mockReturnValue(false);
         vi.mocked(discordService.isDiscordAdmin).mockResolvedValue(true);
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_2",
            role: "ADMIN",
         } as never);

         const role = await syncUserRoleFromDiscord(
            "user_2",
            "admin_snowflake"
         );

         expect(role).toBe("ADMIN");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_2" },
            data: { role: "ADMIN" },
         });
      });

      it("assigns PARTICIPANT role when neither is true", async () => {
         vi.mocked(discordService.isDiscordDev).mockReturnValue(false);
         vi.mocked(discordService.isDiscordAdmin).mockResolvedValue(false);
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_3",
            role: "PARTICIPANT",
         } as never);

         const role = await syncUserRoleFromDiscord(
            "user_3",
            "normal_snowflake"
         );

         expect(role).toBe("PARTICIPANT");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_3" },
            data: { role: "PARTICIPANT" },
         });
      });
   });

   describe("findUserById", () => {
      it("calls prisma.user.findUnique with id", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_1",
         } as never);

         const user = await findUserById("user_1");
         expect(user).toEqual({ id: "user_1" });
         expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: "user_1" },
         });
      });
   });

   describe("findUserByDiscordId", () => {
      it("calls prisma.user.findUnique with discordId", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_1",
            discordId: "disc_1",
         } as never);

         const user = await findUserByDiscordId("disc_1");
         expect(user).toEqual({ id: "user_1", discordId: "disc_1" });
         expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { discordId: "disc_1" },
         });
      });
   });

   describe("findUserByUsername", () => {
      it("queries user with case-insensitive exact lower-case match", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([
            {
               id: "user_1",
               username: "Alice_Scholar",
            },
         ] as never);

         const user = await findUserByUsername("  ALICE_SCHOLAR  ");
         expect(user).toEqual({ id: "user_1", username: "Alice_Scholar" });
         expect(prisma.$queryRaw).toHaveBeenCalled();
      });
   });

   describe("isUsernameAvailable", () => {
      it("returns true when no user matches the candidate", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

         const available = await isUsernameAvailable("NewScholar");
         expect(available).toBe(true);
         expect(prisma.$queryRaw).toHaveBeenCalled();
      });

      it("returns false when user with candidate exists", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([
            { id: "other_user" },
         ] as never);

         const available = await isUsernameAvailable("ExistingScholar");
         expect(available).toBe(false);
      });

      it("excludes current user ID if provided", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

         const available = await isUsernameAvailable("MyOwnUsername", "user_1");
         expect(available).toBe(true);
         expect(prisma.$queryRaw).toHaveBeenCalled();
      });
   });

   describe("updateUsername", () => {
      it("updates username preserving casing when valid and available", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never); // available
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_1",
            username: "StudyPro_99",
         } as never);

         const updated = await updateUsername("user_1", "StudyPro_99");
         expect(updated.username).toBe("StudyPro_99");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
               username: "StudyPro_99",
               usernameChangedAt: expect.any(Date),
            },
         });
      });

      it("throws UsernameTakenError if username is taken", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([
            { id: "other" },
         ] as never);

         await expect(updateUsername("user_1", "TakenName")).rejects.toThrow(
            UsernameTakenError
         );
      });

      it("catches Prisma P2002 race condition and throws UsernameTakenError", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
         vi.mocked(prisma.user.update).mockRejectedValue({ code: "P2002" });

         await expect(
            updateUsername("user_1", "RaceCondition")
         ).rejects.toThrow(UsernameTakenError);
      });
   });

   describe("provisionInitialUsername", () => {
      it("returns sanitized candidate when available", async () => {
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

         const candidate = await provisionInitialUsername("user_1", "Alice.99");
         expect(candidate).toBe("Alice_99");
      });

      it("suffixes on collision until an available candidate is found", async () => {
         // First candidate taken, second available
         vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([{ id: "other" }] as never) // Alice_99 taken
            .mockResolvedValueOnce([] as never); // Alice_99_1 available

         const candidate = await provisionInitialUsername("user_1", "Alice.99");
         expect(candidate).toBe("Alice_99_1");
      });
   });

   describe("syncUserFromDiscordProfile", () => {
      it("preserves existing username if user already has one assigned", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_1",
            username: "CustomScholarHandle",
         } as never);
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_1",
            username: "CustomScholarHandle",
         } as never);

         await syncUserFromDiscordProfile("user_1", {
            providerAccountId: "disc_123",
            username: "NewDiscordName",
            globalName: "New Global Name",
            image: "avatar.png",
         });

         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
               discordId: "disc_123",
               displayName: "New Global Name",
               image: "avatar.png",
               name: "New Global Name",
               // username should NOT be overwritten with NewDiscordName!
               username: "CustomScholarHandle",
            },
         });
      });

      it("provisions initial username if user currently has no username", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user_new",
            username: null,
         } as never);
         vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never); // available
         vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user_new",
            username: "FreshUser",
         } as never);

         await syncUserFromDiscordProfile("user_new", {
            providerAccountId: "disc_456",
            username: "FreshUser",
            globalName: "Fresh Display",
            image: "avatar.png",
         });

         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_new" },
            data: {
               discordId: "disc_456",
               displayName: "Fresh Display",
               image: "avatar.png",
               name: "Fresh Display",
               username: "FreshUser",
            },
         });
      });
   });
});
