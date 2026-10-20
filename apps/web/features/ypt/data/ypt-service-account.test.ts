import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignIn = vi.fn();

vi.mock("ypt-js", () => {
   class MockYptJs {
      auth = { signIn: mockSignIn };
      groups = {};
      constructor(_opts?: unknown) {}
   }
   return { YptJs: MockYptJs, YptClient: MockYptJs };
});

vi.mock("./ypt-client.service", () => ({
   getYptGroupMembers: vi.fn(),
   getYptAllJoinedMembers: vi.fn(),
}));

import {
   getYptServiceRoster,
   resetYptServiceClient,
   resetYptServiceRoster,
} from "./ypt-service-account";
import {
   getYptGroupMembers,
   getYptAllJoinedMembers,
} from "./ypt-client.service";

function member(userId: number, nickname: string) {
   return {
      userId,
      nickname,
      avatarUrl: null,
      todayStudyMs: 3_600_000,
      liveStudyMs: 3_600_000,
      isStudying: false,
      isPaused: false,
      currentSubject: null,
      studyDate: "2026-10-19",
      groupIds: [],
      groupNames: [],
   } as any;
}

describe("features/ypt/data/ypt-service-account", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      resetYptServiceClient();
      resetYptServiceRoster();
      process.env.YPT_EMAIL = "service@example.com";
      process.env.YPT_PASSWORD = "secret123";
      process.env.YPT_GROUP_IDS = "";
      mockSignIn.mockResolvedValue({
         id: 1,
         nickname: "service",
         email: "service@example.com",
         today: null,
      });
   });

   it("authenticates with YPT_EMAIL/YPT_PASSWORD and reads all joined members", async () => {
      vi.mocked(getYptAllJoinedMembers).mockResolvedValue([
         member(101, "Afnan"),
      ]);

      const roster = await getYptServiceRoster();

      expect(mockSignIn).toHaveBeenCalledWith({
         email: "service@example.com",
         password: "secret123",
      });
      expect(roster).toHaveLength(1);
      expect(roster[0].yptUserId).toBe("101");
      expect(roster[0].todayStudySeconds).toBe(3600);
   });

   it("scopes to configured group ids and de-duplicates members", async () => {
      process.env.YPT_GROUP_IDS = "111,222";
      vi.mocked(getYptGroupMembers).mockImplementation(
         async (_client: any, groupId: any) => {
            if (String(groupId) === "111") {
               return [member(101, "Afnan")];
            }
            return [member(101, "Afnan"), member(202, "Someone")];
         }
      );

      const roster = await getYptServiceRoster();

      expect(getYptGroupMembers).toHaveBeenCalledTimes(2);
      expect(roster).toHaveLength(2);
      const first = roster.find((m) => m.yptUserId === "101");
      expect(first?.groupIds.sort()).toEqual(["111", "222"]);
   });

   it("throws when the service credentials are not configured", async () => {
      process.env.YPT_EMAIL = "";
      process.env.YPT_PASSWORD = "";

      await expect(getYptServiceRoster()).rejects.toThrow("not configured");
   });

   it("serves the roster from cache on subsequent calls", async () => {
      vi.mocked(getYptAllJoinedMembers).mockResolvedValue([
         member(101, "Afnan"),
      ]);

      await getYptServiceRoster();
      await getYptServiceRoster();

      expect(getYptAllJoinedMembers).toHaveBeenCalledTimes(1);
   });
});
