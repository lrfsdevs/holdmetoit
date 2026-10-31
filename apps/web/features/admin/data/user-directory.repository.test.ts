import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import {
   getAdminUserRoster,
   resolveRosterRole,
   resolveYptStatus,
} from "./user-directory.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findMany: vi.fn(),
      },
   },
}));

describe("user-directory.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("resolveRosterRole", () => {
      it("maps DEV to ADMIN", () => {
         expect(resolveRosterRole("DEV", 0)).toBe("ADMIN");
         expect(resolveRosterRole("DEV", 2)).toBe("ADMIN");
      });

      it("maps ADMIN with no hosted challenges to ADMIN", () => {
         expect(resolveRosterRole("ADMIN", 0)).toBe("ADMIN");
      });

      it("maps ADMIN with hosted challenges to HOST", () => {
         expect(resolveRosterRole("ADMIN", 1)).toBe("HOST");
      });

      it("maps PARTICIPANT with hosted challenges to HOST", () => {
         expect(resolveRosterRole("PARTICIPANT", 3)).toBe("HOST");
      });

      it("maps standard PARTICIPANT to USER", () => {
         expect(resolveRosterRole("PARTICIPANT", 0)).toBe("USER");
      });
   });

   describe("resolveYptStatus", () => {
      it("maps CONNECTED and VERIFIED to CONNECTED", () => {
         expect(resolveYptStatus("CONNECTED")).toBe("CONNECTED");
         expect(resolveYptStatus("VERIFIED")).toBe("CONNECTED");
      });

      it("maps error states to ERROR", () => {
         expect(resolveYptStatus("SYNC_ERROR")).toBe("ERROR");
         expect(resolveYptStatus("REAUTHENTICATION_REQUIRED")).toBe("ERROR");
      });

      it("maps NOT_CONNECTED, REJECTED, or null/undefined to DISCONNECTED", () => {
         expect(resolveYptStatus("NOT_CONNECTED")).toBe("DISCONNECTED");
         expect(resolveYptStatus("REJECTED")).toBe("DISCONNECTED");
         expect(resolveYptStatus(null)).toBe("DISCONNECTED");
         expect(resolveYptStatus(undefined)).toBe("DISCONNECTED");
      });
   });

   describe("getAdminUserRoster", () => {
      const fixedNow = new Date("2026-10-15T12:00:00.000Z");

      const mockUsers = [
         {
            id: "u1",
            displayName: "Alice Active",
            username: "alice_tag",
            name: "Alice A",
            image: "https://avatar.test/alice.png",
            discordId: "111222333444555",
            role: "PARTICIPANT",
            createdAt: new Date("2026-09-01T00:00:00.000Z"),
            trophyBalance: 1200,
            wallet: { totalBalance: 500 },
            yptConnection: { status: "CONNECTED" },
            hostedChallenges: [],
            participations: [
               {
                  id: "part_1",
                  challenge: {
                     id: "chal_active",
                     title: "October Sprint",
                     format: "SOLOS",
                     startAt: new Date("2026-10-01T00:00:00.000Z"),
                     endAt: new Date("2026-10-31T00:00:00.000Z"),
                     resultsLockedAt: null,
                  },
                  dailyStudyLogs: [
                     { durationSeconds: 7200 },
                     { durationSeconds: 3600 },
                  ],
               },
            ],
         },
         {
            id: "u2",
            displayName: "Bob Host",
            username: "bob_tag",
            name: "Bob B",
            image: null,
            discordId: "222333444555666",
            role: "ADMIN",
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
            trophyBalance: 300,
            wallet: { totalBalance: 120 },
            yptConnection: { status: "NOT_CONNECTED" },
            hostedChallenges: [{ id: "chal_1" }],
            participations: [
               {
                  id: "part_2",
                  challenge: {
                     id: "chal_past",
                     title: "September Classic",
                     format: "TEAM_VS_TEAM",
                     startAt: new Date("2026-09-01T00:00:00.000Z"),
                     endAt: new Date("2026-09-10T00:00:00.000Z"),
                     resultsLockedAt: new Date("2026-09-11T00:00:00.000Z"),
                  },
                  dailyStudyLogs: [{ durationSeconds: 36000 }],
               },
            ],
         },
         {
            id: "u3",
            displayName: "Charlie Newbie",
            username: "charlie_tag",
            name: "Charlie C",
            image: null,
            discordId: "333444555666777",
            role: "PARTICIPANT",
            createdAt: new Date("2026-10-10T00:00:00.000Z"),
            trophyBalance: 0,
            wallet: null,
            yptConnection: null,
            hostedChallenges: [],
            participations: [],
         },
      ];

      it("returns all users with mapped attributes and summary counters", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         const result = await getAdminUserRoster({}, { now: fixedNow });

         expect(result.totalCount).toBe(3);
         expect(result.totalPages).toBe(1);
         expect(result.summary).toEqual({
            totalUsers: 3,
            activeEnrolledUsers: 1, // u1 has active challenge
            unenrolledUsers: 2, // u2 and u3 have no active challenges
            yptConnectedUsers: 1, // u1 is connected
         });

         const alice = result.items.find((i) => i.id === "u1")!;
         const bob = result.items.find((i) => i.id === "u2")!;
         const charlie = result.items.find((i) => i.id === "u3")!;
         expect(alice.name).toBe("Alice Active");
         expect(alice.role).toBe("USER");
         expect(alice.yptStatus).toBe("CONNECTED");
         expect(alice.lifetimeStudyHours).toBe(3.0); // (7200 + 3600) / 3600 = 3h
         expect(alice.activeChallenges).toHaveLength(1);
         expect(alice.activeChallenges[0].title).toBe("October Sprint");

         expect(bob.name).toBe("Bob Host");
         expect(bob.role).toBe("HOST"); // ADMIN + hostedChallenges -> HOST
         expect(bob.yptStatus).toBe("DISCONNECTED");
         expect(bob.lifetimeStudyHours).toBe(10.0); // 36000 / 3600
         expect(bob.activeChallenges).toHaveLength(0); // challenge ended in September
         expect(bob.totalChallengesCount).toBe(1);

         expect(charlie.name).toBe("Charlie Newbie");
         expect(charlie.role).toBe("USER");
         expect(charlie.walletBalance).toBe(0);
         expect(charlie.totalChallengesCount).toBe(0);
      });

      it("filters by search term (name, tag, or discordId)", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         // Search by snowflake
         const resSnowflake = await getAdminUserRoster(
            { search: "333444555666777" },
            { now: fixedNow }
         );
         expect(resSnowflake.items).toHaveLength(1);
         expect(resSnowflake.items[0].name).toBe("Charlie Newbie");

         // Search by username tag
         const resTag = await getAdminUserRoster(
            { search: "alice_tag" },
            { now: fixedNow }
         );
         expect(resTag.items).toHaveLength(1);
         expect(resTag.items[0].name).toBe("Alice Active");
      });

      it("filters by roleFilter", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         const resHost = await getAdminUserRoster(
            { roleFilter: "HOST" },
            { now: fixedNow }
         );
         expect(resHost.items).toHaveLength(1);
         expect(resHost.items[0].name).toBe("Bob Host");

         const resUser = await getAdminUserRoster(
            { roleFilter: "USER" },
            { now: fixedNow }
         );
         expect(resUser.items).toHaveLength(2);
      });

      it("filters by enrollmentFilter (ACTIVE, IDLE, NEVER_ENROLLED)", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         const resActive = await getAdminUserRoster(
            { enrollmentFilter: "ACTIVE" },
            { now: fixedNow }
         );
         expect(resActive.items).toHaveLength(1);
         expect(resActive.items[0].id).toBe("u1");

         const resIdle = await getAdminUserRoster(
            { enrollmentFilter: "IDLE" },
            { now: fixedNow }
         );
         expect(resIdle.items).toHaveLength(1);
         expect(resIdle.items[0].id).toBe("u2");

         const resNever = await getAdminUserRoster(
            { enrollmentFilter: "NEVER_ENROLLED" },
            { now: fixedNow }
         );
         expect(resNever.items).toHaveLength(1);
         expect(resNever.items[0].id).toBe("u3");
      });

      it("filters by yptFilter", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         const resConn = await getAdminUserRoster(
            { yptFilter: "CONNECTED" },
            { now: fixedNow }
         );
         expect(resConn.items).toHaveLength(1);
         expect(resConn.items[0].id).toBe("u1");

         const resDisc = await getAdminUserRoster(
            { yptFilter: "DISCONNECTED" },
            { now: fixedNow }
         );
         expect(resDisc.items).toHaveLength(2);
      });

      it("sorts by lifetimeHours and trophies", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         // By lifetime hours descending: Bob (10h) > Alice (3h) > Charlie (0h)
         const resHours = await getAdminUserRoster(
            { sortBy: "lifetimeHours", sortDirection: "desc" },
            { now: fixedNow }
         );
         expect(resHours.items.map((i) => i.id)).toEqual(["u2", "u1", "u3"]);

         // By trophies descending: Alice (1200) > Bob (300) > Charlie (0)
         const resTrophies = await getAdminUserRoster(
            { sortBy: "trophies", sortDirection: "desc" },
            { now: fixedNow }
         );
         expect(resTrophies.items.map((i) => i.id)).toEqual(["u1", "u2", "u3"]);
      });

      it("paginates items correctly", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

         const resPage1 = await getAdminUserRoster(
            { page: 1, pageSize: 2 },
            { now: fixedNow }
         );
         expect(resPage1.items).toHaveLength(2);
         expect(resPage1.page).toBe(1);
         expect(resPage1.totalPages).toBe(2);

         const resPage2 = await getAdminUserRoster(
            { page: 2, pageSize: 2 },
            { now: fixedNow }
         );
         expect(resPage2.items).toHaveLength(1);
         expect(resPage2.page).toBe(2);
      });
   });
});
