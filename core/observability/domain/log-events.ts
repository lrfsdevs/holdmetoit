/**
 * Canonical catalog of diagnostic log events.
 *
 * This is a runtime diagnostics vocabulary (stdout + LogRocket), separate from
 * the business audit trail in `features/audit`. Keeping the names here prevents
 * drift between instrumentation sites and makes logs queryable by a stable key.
 */
export const logEvents = {
   authDiscordSignin: "auth.discord_signin",
   authUserSynced: "auth.user_synced",
   authRoleSyncFailed: "auth.role_sync_failed",
   authSignout: "auth.signout",
   authPreviewToggled: "auth.preview_toggled",

   challengeCreated: "challenge.created",
   challengeUpdated: "challenge.updated",
   challengeDeleted: "challenge.deleted",
   challengeKickoff: "challenge.kickoff",
   challengeLocked: "challenge.locked",
   challengeUnlocked: "challenge.unlocked",
   challengeEnrolled: "challenge.enrolled",
   challengeParticipantRemoved: "challenge.participant_removed",
   challengeParticipantReassigned: "challenge.participant_reassigned",
   challengeTargetOverridden: "challenge.target_overridden",
   challengeImageUploaded: "challenge.image_uploaded",
   challengeImageDiscarded: "challenge.image_discarded",

   studyLogAdded: "study_log.added",
   studyLogOverride: "study_log.override",
   studyLogTotalReset: "study_log.total_reset",

   leaderboardManualLogged: "leaderboard.manual_logged",
   leaderboardManualBatchLogged: "leaderboard.manual_batch_logged",

   accountabilityPardoned: "accountability.pardoned",

   wrappedSeen: "wrapped.seen",
   wrappedAutoSeen: "wrapped.auto_seen",

   taskCreated: "task.created",
   taskUpdated: "task.updated",
   taskDeleted: "task.deleted",
   taskToggled: "task.toggled",
   taskCategoryCreated: "task.category_created",
   taskCategoryUpdated: "task.category_updated",
   taskCategoryDeleted: "task.category_deleted",

   tasksSyncBatchApplied: "tasks_sync.batch_applied",
   tasksSyncFailed: "tasks_sync.failed",
   tasksSyncLocal: "tasks_sync.local",

   feedbackSubmitted: "feedback.submitted",
   feedbackDiscordDispatchFailed: "feedback.discord_dispatch_failed",

   storageUploadFailed: "storage.upload_failed",
   storageCleanupSkipped: "storage.cleanup_skipped",

   auditTrailReadFailed: "audit.trail_read_failed",
   auditPersistFailed: "audit.persist_failed",
   auditQueryFailed: "audit.query_failed",

   appError: "app.error",
} as const;

export type LogEventName = (typeof logEvents)[keyof typeof logEvents];
