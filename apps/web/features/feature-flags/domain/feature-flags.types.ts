export type RolloutModeType = "DISABLED" | "TARGETED" | "GLOBAL";

export interface FeatureFlagTargetUser {
   id: string;
   name?: string | null;
   username?: string | null;
   displayName?: string | null;
   image?: string | null;
   discordId?: string | null;
}

export interface FeatureFlagTargetEntity {
   flagId: string;
   userId: string;
   createdBy: string;
   createdAt: Date | string;
   user?: FeatureFlagTargetUser;
}

export interface FeatureFlagAuditActor {
   id: string;
   name?: string | null;
   username?: string | null;
   displayName?: string | null;
   image?: string | null;
}

export interface FeatureFlagAuditLogEntry {
   id: string;
   flagId: string;
   actorId?: string | null;
   action: string;
   oldValue?: unknown;
   newValue?: unknown;
   createdAt: Date | string;
   actor?: FeatureFlagAuditActor | null;
}

export interface FeatureFlagEntity {
   id: string;
   key: string;
   name: string;
   description?: string | null;
   isEnabled: boolean;
   rolloutMode: RolloutModeType;
   createdBy: string;
   isDeleted: boolean;
   deletedAt?: Date | string | null;
   createdAt: Date | string;
   updatedAt: Date | string;
   targets?: FeatureFlagTargetEntity[];
   targetUserIds?: string[];
   auditLogs?: FeatureFlagAuditLogEntry[];
   creator?: {
      id: string;
      displayName?: string | null;
      username?: string | null;
   } | null;
}

export interface FlagEvaluationContext {
   userId?: string | null;
   userRole?: string | null;
   isSpectator?: boolean;
}
