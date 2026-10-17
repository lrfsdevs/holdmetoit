import {
   YptJs,
   type Group,
   type GroupMember,
   type UnifiedMember,
   type YptUser,
} from "ypt-js";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("ypt.client-service");

export interface YptAuthCredentials {
   email: string;
   password: string;
}

export interface YptAuthResult {
   user: YptUser;
   refreshToken?: string;
   accessToken?: string;
}

export interface YptUserStudyStatus {
   yptUserId: number;
   nickname: string;
   todayStudyMs: number;
   liveStudyMs: number;
   todayStudySeconds: number;
   liveStudySeconds: number;
   isStudying: boolean;
   isPaused: boolean;
   currentSubject: string | null;
   studyDate: string | null;
}

/**
 * Creates and authenticates a YptJs instance using email and password.
 * Throws on invalid credentials or suspended accounts.
 */
import { classifyYptError } from "@/features/ypt/domain/ypt-error-classifier";

export async function authenticateYptAccount(
   credentials: YptAuthCredentials
): Promise<YptAuthResult> {
   let capturedRefreshToken: string | undefined;
   let capturedAccessToken: string | undefined;

   const client = new YptJs({
      onTokenChange: (token, refreshToken) => {
         capturedAccessToken = token;
         if (refreshToken) {
            capturedRefreshToken = refreshToken;
         }
      },
      onSessionChange: (session) => {
         capturedAccessToken = session.accessToken;
         if (session.refreshToken) {
            capturedRefreshToken = session.refreshToken;
         }
      },
   });

   try {
      const user = await client.auth.signIn({
         email: credentials.email.trim(),
         password: credentials.password,
      });

      return {
         user,
         refreshToken: capturedRefreshToken || client.refreshToken,
         accessToken: capturedAccessToken || client.token,
      };
   } catch (error) {
      const classified = classifyYptError(error, "authenticateYptAccount");
      logger.error(logEvents.appError, {
         context: {
            action: "authenticateYptAccount",
            httpStatus: classified.safeLogContext.httpStatus,
            apiCode: classified.safeLogContext.apiCode,
            errorKind: classified.kind,
            sanitizedMessage: classified.sanitizedMessage,
            email: credentials.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
         },
      });
      throw error;
   }
}

/**
 * Creates an authenticated YptJs client by restoring a stored session refresh token.
 */
export async function restoreYptClientSession(
   refreshToken: string
): Promise<YptJs> {
   const client = new YptJs({
      refreshToken,
   });

   try {
      const res = await client.auth.restoreSession(refreshToken);
      if (!res.success) {
         throw new Error("YPT session restoration failed.");
      }
      return client;
   } catch (error) {
      const classified = classifyYptError(error, "restoreYptClientSession");
      logger.warn(logEvents.appError, {
         context: {
            action: "restoreYptClientSession",
            reason: "Failed to restore session via refresh token",
            httpStatus: classified.safeLogContext.httpStatus,
            apiCode: classified.safeLogContext.apiCode,
            errorKind: classified.kind,
         },
      });
      throw error;
   }
}

/**
 * Retrieves all study groups joined by the authenticated YPT user.
 */
export async function getYptJoinedGroups(client: YptJs): Promise<Group[]> {
   try {
      return await client.groups.listJoined();
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { action: "getYptJoinedGroups" },
         error,
      });
      throw error;
   }
}

/**
 * Retrieves all members of a specific YPT study group with real-time study status.
 */
export async function getYptGroupMembers(
   client: YptJs,
   groupId: number | string
): Promise<GroupMember[]> {
   try {
      return await client.groups.getMembers(groupId);
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { action: "getYptGroupMembers", groupId },
         error,
      });
      throw error;
   }
}

/**
 * Retrieves unified deduplicated members across all joined study groups.
 */
export async function getYptAllJoinedMembers(
   client: YptJs
): Promise<UnifiedMember[]> {
   try {
      const result = await client.groups.listAllMembers({ concurrency: 2 });
      return result.members;
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { action: "getYptAllJoinedMembers" },
         error,
      });
      throw error;
   }
}

/**
 * Looks up a member by numeric YPT ID across groups to extract current study duration.
 */
export async function getYptUserStudyStatus(
   client: YptJs,
   yptUserId: number
): Promise<YptUserStudyStatus | null> {
   try {
      // 1. Try fetching all members across joined groups
      const unifiedResult = await client.groups.listAllMembers({
         concurrency: 2,
      });
      const found = unifiedResult.members.find((m) => m.userId === yptUserId);

      if (found) {
         const todaySeconds = Math.max(
            0,
            Math.floor(found.todayStudyMs / 1000)
         );
         const liveSeconds = Math.max(0, Math.floor(found.liveStudyMs / 1000));

         return {
            yptUserId: found.userId,
            nickname: found.nickname,
            todayStudyMs: found.todayStudyMs,
            liveStudyMs: found.liveStudyMs,
            todayStudySeconds: todaySeconds,
            liveStudySeconds: liveSeconds,
            isStudying: found.isStudying,
            isPaused: found.isPaused,
            currentSubject: found.currentSubject,
            studyDate: found.studyDate,
         };
      }

      // 2. If not found in listAllMembers, check individual joined groups
      const groups = await client.groups.listJoined();
      for (const group of groups) {
         const members = await client.groups.getMembers(group.id);
         const m = members.find((member) => member.userId === yptUserId);
         if (m) {
            const todaySeconds = Math.max(0, Math.floor(m.todayStudyMs / 1000));
            const liveSeconds = Math.max(0, Math.floor(m.liveStudyMs / 1000));
            return {
               yptUserId: m.userId,
               nickname: m.nickname,
               todayStudyMs: m.todayStudyMs,
               liveStudyMs: m.liveStudyMs,
               todayStudySeconds: todaySeconds,
               liveStudySeconds: liveSeconds,
               isStudying: m.isStudying,
               isPaused: m.isPaused,
               currentSubject: m.currentSubject,
               studyDate: m.studyDate,
            };
         }
      }

      return null;
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { action: "getYptUserStudyStatus", yptUserId },
         error,
      });
      throw error;
   }
}
