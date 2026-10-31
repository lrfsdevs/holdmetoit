export type AdminRosterRole = "USER" | "HOST" | "ADMIN";

export type AdminEnrollmentFilter =
   "ALL" | "ACTIVE" | "IDLE" | "NEVER_ENROLLED";

export type AdminYptFilter = "ALL" | "CONNECTED" | "DISCONNECTED";

export type AdminUserSortBy = "createdAt" | "lifetimeHours" | "trophies";

export type AdminYptStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface ActiveChallengeItem {
   id: string;
   participantId: string;
   title: string;
   mode: string;
}

export interface AdminUserRosterItem {
   id: string;
   discordId: string | null;
   name: string;
   discordTag: string;
   image: string | null;
   role: AdminRosterRole;
   createdAt: string;
   lifetimeStudyHours: number;
   trophies: number;
   trophyRank: string;
   walletBalance: number;
   yptStatus: AdminYptStatus;
   activeChallenges: ActiveChallengeItem[];
   totalChallengesCount: number;
}

export interface UserDirectoryQuery {
   search?: string;
   roleFilter?: "ALL" | AdminRosterRole;
   enrollmentFilter?: AdminEnrollmentFilter;
   yptFilter?: AdminYptFilter;
   sortBy?: AdminUserSortBy;
   sortDirection?: "asc" | "desc";
   page?: number;
   pageSize?: number;
}

export interface UserDirectorySummary {
   totalUsers: number;
   activeEnrolledUsers: number;
   unenrolledUsers: number;
   yptConnectedUsers: number;
}

export interface AdminUserRosterResult {
   items: AdminUserRosterItem[];
   totalCount: number;
   page: number;
   pageSize: number;
   totalPages: number;
   summary: UserDirectorySummary;
}
