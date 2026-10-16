import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   authenticateYptAccount,
   restoreYptClientSession,
   getYptJoinedGroups,
   getYptGroupMembers,
   getYptUserStudyStatus,
} from "./ypt-client.service";

const mockSignIn = vi.fn();
const mockRestoreSession = vi.fn();
const mockListJoined = vi.fn();
const mockGetMembers = vi.fn();
const mockListAllMembers = vi.fn();

vi.mock("ypt-js", () => {
   class MockYptJs {
      refreshToken = "mock-refresh-token";
      token = "mock-access-token";
      auth = {
         signIn: mockSignIn,
         restoreSession: mockRestoreSession,
      };
      groups = {
         listJoined: mockListJoined,
         getMembers: mockGetMembers,
         listAllMembers: mockListAllMembers,
      };
      constructor(opts?: any) {
         if (opts?.onTokenChange) {
            opts.onTokenChange(this.token, this.refreshToken);
         }
      }
   }

   return {
      YptJs: MockYptJs,
      YptClient: MockYptJs,
   };
});

describe("features/ypt/data/ypt-client.service", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      mockRestoreSession.mockResolvedValue({ success: true });
   });

   it("authenticates account and returns user with tokens", async () => {
      const mockUser = {
         id: 11338944,
         nickname: "Afnan Pathan",
         email: "afnan@example.com",
         today: "2026-10-16",
      };
      mockSignIn.mockResolvedValue(mockUser);

      const result = await authenticateYptAccount({
         email: "afnan@example.com",
         password: "SecurePassword123!",
      });

      expect(result.user.id).toBe(11338944);
      expect(result.user.nickname).toBe("Afnan Pathan");
      expect(result.refreshToken).toBe("mock-refresh-token");
      expect(mockSignIn).toHaveBeenCalledWith({
         email: "afnan@example.com",
         password: "SecurePassword123!",
      });
   });

   it("restores session via refresh token successfully", async () => {
      mockRestoreSession.mockResolvedValue({ success: true });

      const client = await restoreYptClientSession("valid-refresh-token");
      expect(client).toBeDefined();
      expect(mockRestoreSession).toHaveBeenCalledWith("valid-refresh-token");
   });

   it("throws when session restoration fails", async () => {
      mockRestoreSession.mockResolvedValue({ success: false });

      await expect(restoreYptClientSession("expired-token")).rejects.toThrow(
         "YPT session restoration failed."
      );
   });

   it("retrieves joined groups", async () => {
      mockListJoined.mockResolvedValue([
         { id: 101, name: "HoldMeToIt Study Squad", memberCount: 15 },
      ]);

      const client = await restoreYptClientSession("tok");
      const groups = await getYptJoinedGroups(client);

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe("HoldMeToIt Study Squad");
   });

   it("retrieves group members", async () => {
      mockGetMembers.mockResolvedValue([
         {
            userId: 11338944,
            nickname: "Afnan Pathan",
            todayStudyMs: 7200000,
            isStudying: true,
         },
      ]);

      const client = await restoreYptClientSession("tok");
      const members = await getYptGroupMembers(client, 101);

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(11338944);
      expect(members[0].todayStudyMs).toBe(7200000);
   });

   it("retrieves user study status and converts milliseconds to seconds", async () => {
      mockListAllMembers.mockResolvedValue({
         members: [
            {
               userId: 11338944,
               nickname: "Afnan Pathan",
               todayStudyMs: 7200000, // 2 hours = 7200 seconds
               liveStudyMs: 7250000,
               isStudying: true,
               isPaused: false,
               currentSubject: "Algorithms",
               studyDate: "2026-10-16",
            },
         ],
      });

      const client = await restoreYptClientSession("tok");
      const status = await getYptUserStudyStatus(client, 11338944);

      expect(status).not.toBeNull();
      expect(status?.yptUserId).toBe(11338944);
      expect(status?.todayStudySeconds).toBe(7200);
      expect(status?.liveStudySeconds).toBe(7250);
      expect(status?.isStudying).toBe(true);
      expect(status?.currentSubject).toBe("Algorithms");
   });
});
