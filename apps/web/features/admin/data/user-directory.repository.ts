import { prisma } from "@/core/db";
import { getRankForTrophies } from "@/features/trophies/domain/trophy-rank";
import type {
   AdminEnrollmentFilter,
   AdminRosterRole,
   AdminUserRosterItem,
   AdminUserRosterResult,
   AdminYptFilter,
   AdminYptStatus,
   ActiveChallengeItem,
   UserDirectoryQuery,
   UserDirectorySummary,
} from "../domain/user-directory.types";

export interface GetAdminUserRosterOptions {
   now?: Date;
}

export function resolveRosterRole(
   userRole: string,
   hostedCount: number
): AdminRosterRole {
   if (userRole === "DEV") return "ADMIN";
   if (userRole === "ADMIN") return hostedCount > 0 ? "HOST" : "ADMIN";
   if (hostedCount > 0) return "HOST";
   return "USER";
}

export function resolveYptStatus(status?: string | null): AdminYptStatus {
   if (status === "CONNECTED" || status === "VERIFIED") return "CONNECTED";
   if (status === "SYNC_ERROR" || status === "REAUTHENTICATION_REQUIRED") {
      return "ERROR";
   }
   return "DISCONNECTED";
}

/**
 * Fetches the global platform user roster for hosts/administrators with full career aggregates,
 * active challenge statuses, YPT connection status, and search/filter/sort pagination.
 */
export async function getAdminUserRoster(
   query: UserDirectoryQuery = {},
   options: GetAdminUserRosterOptions = {}
): Promise<AdminUserRosterResult> {
   const now = options.now ?? new Date();

   const page = Math.max(1, query.page || 1);
   const pageSize = Math.min(100, Math.max(1, query.pageSize || 10));
   const sortBy = query.sortBy || "createdAt";
   const sortDirection = query.sortDirection || "desc";
   const search = query.search?.trim().toLowerCase() || "";
   const roleFilter = query.roleFilter || "ALL";
   const enrollmentFilter: AdminEnrollmentFilter =
      query.enrollmentFilter || "ALL";
   const yptFilter: AdminYptFilter = query.yptFilter || "ALL";

   // Fetch all users with nested aggregations needed for directory metrics
   const users = await prisma.user.findMany({
      select: {
         id: true,
         name: true,
         username: true,
         displayName: true,
         image: true,
         discordId: true,
         role: true,
         createdAt: true,
         trophyBalance: true,
         wallet: {
            select: {
               totalBalance: true,
            },
         },
         yptConnection: {
            select: {
               status: true,
            },
         },
         hostedChallenges: {
            where: { isDeleted: false },
            select: { id: true },
         },
         participations: {
            where: {
               challenge: {
                  isDeleted: false,
               },
            },
            select: {
               id: true,
               challenge: {
                  select: {
                     id: true,
                     title: true,
                     format: true,
                     startAt: true,
                     endAt: true,
                     resultsLockedAt: true,
                  },
               },
               dailyStudyLogs: {
                  select: {
                     durationSeconds: true,
                  },
               },
            },
         },
      },
      orderBy: { createdAt: "desc" },
   });

   // Map raw database users into domain roster items
   const allItems: AdminUserRosterItem[] = users.map((user) => {
      const activeChallenges: ActiveChallengeItem[] = [];
      let lifetimeStudySeconds = 0;

      for (const p of user.participations || []) {
         const ch = p.challenge;
         const startTime = new Date(ch.startAt).getTime();
         const endTime = new Date(ch.endAt).getTime();
         const currentTime = now.getTime();

         const isChallengeActive =
            currentTime >= startTime &&
            currentTime < endTime &&
            ch.resultsLockedAt == null;

         if (isChallengeActive) {
            activeChallenges.push({
               id: ch.id,
               participantId: p.id,
               title: ch.title,
               mode: ch.format,
            });
         }

         for (const log of p.dailyStudyLogs || []) {
            lifetimeStudySeconds += log.durationSeconds || 0;
         }
      }

      const hostedCount = user.hostedChallenges?.length || 0;
      const role = resolveRosterRole(user.role, hostedCount);
      const yptStatus = resolveYptStatus(user.yptConnection?.status);
      const trophies = user.trophyBalance ?? 0;
      const trophyRank = getRankForTrophies(trophies).role;
      const walletBalance = user.wallet?.totalBalance ?? 0;
      const lifetimeStudyHours =
         Math.round((lifetimeStudySeconds / 3600) * 10) / 10;

      return {
         id: user.id,
         discordId: user.discordId,
         name: user.displayName || user.name || user.username || "Anonymous",
         discordTag:
            user.username || user.displayName || user.name || "Unknown",
         image: user.image,
         role,
         createdAt: user.createdAt.toISOString(),
         lifetimeStudyHours,
         trophies,
         trophyRank,
         walletBalance,
         yptStatus,
         activeChallenges,
         totalChallengesCount: user.participations?.length || 0,
      };
   });

   // Compute top-level summary metrics before query filtering
   const summary: UserDirectorySummary = {
      totalUsers: allItems.length,
      activeEnrolledUsers: allItems.filter((u) => u.activeChallenges.length > 0)
         .length,
      unenrolledUsers: allItems.filter((u) => u.activeChallenges.length === 0)
         .length,
      yptConnectedUsers: allItems.filter((u) => u.yptStatus === "CONNECTED")
         .length,
   };

   // Apply filters
   let filtered = allItems;

   if (search) {
      filtered = filtered.filter((item) => {
         const nameMatch = item.name.toLowerCase().includes(search);
         const tagMatch = item.discordTag.toLowerCase().includes(search);
         const discordIdMatch = item.discordId
            ? item.discordId.toLowerCase().includes(search)
            : false;
         return nameMatch || tagMatch || discordIdMatch;
      });
   }

   if (roleFilter !== "ALL") {
      filtered = filtered.filter((item) => item.role === roleFilter);
   }

   if (enrollmentFilter === "ACTIVE") {
      filtered = filtered.filter((item) => item.activeChallenges.length > 0);
   } else if (enrollmentFilter === "IDLE") {
      filtered = filtered.filter(
         (item) =>
            item.activeChallenges.length === 0 && item.totalChallengesCount > 0
      );
   } else if (enrollmentFilter === "NEVER_ENROLLED") {
      filtered = filtered.filter((item) => item.totalChallengesCount === 0);
   }

   if (yptFilter === "CONNECTED") {
      filtered = filtered.filter((item) => item.yptStatus === "CONNECTED");
   } else if (yptFilter === "DISCONNECTED") {
      filtered = filtered.filter((item) => item.yptStatus !== "CONNECTED");
   }

   // Sort items
   filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "lifetimeHours") {
         comparison = a.lifetimeStudyHours - b.lifetimeStudyHours;
      } else if (sortBy === "trophies") {
         comparison = a.trophies - b.trophies;
      } else {
         comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
   });

   const totalCount = filtered.length;
   const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
   const startIndex = (page - 1) * pageSize;
   const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

   return {
      items: paginatedItems,
      totalCount,
      page,
      pageSize,
      totalPages,
      summary,
   };
}
