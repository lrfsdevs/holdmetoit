import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import * as discordService from "./discord-guild.service";
import {
   findUserByDiscordId,
   findUserById,
   syncUserRoleFromDiscord,
} from "./user.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
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
         // Admin check should not even be called when dev check matches
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
});
