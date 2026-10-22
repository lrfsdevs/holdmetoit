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
   challengeParticipantWithdrew: "challenge.participant_withdrew",
   challengeParticipantReassigned: "challenge.participant_reassigned",
   challengeTargetOverridden: "challenge.target_overridden",
   challengeImageUploaded: "challenge.image_uploaded",
   challengeImageDiscarded: "challenge.image_discarded",

   studyLogAdded: "study_log.added",
   studyLogOverride: "study_log.override",
   studyLogTotalReset: "study_log.total_reset",

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
   feedbackAttachmentUploadRequested: "feedback.attachment_upload_requested",
   feedbackAttachmentConfirmed: "feedback.attachment_confirmed",
   feedbackAttachmentRejected: "feedback.attachment_rejected",
   feedbackAttachmentDiscarded: "feedback.attachment_discarded",
   feedbackGitHubIssueCreated: "feedback.github_issue_created",
   feedbackGitHubDispatchFailed: "feedback.github_dispatch_failed",
   feedbackGitHubDispatchSkipped: "feedback.github_dispatch_skipped",
   feedbackGitHubLabelRetry: "feedback.github_label_retry",
   feedbackJiraIssueCreated: "feedback.jira_issue_created",
   feedbackJiraDispatchFailed: "feedback.jira_dispatch_failed",
   feedbackJiraDispatchSkipped: "feedback.jira_dispatch_skipped",

   storageUploadFailed: "storage.upload_failed",
   storageCleanupSkipped: "storage.cleanup_skipped",

   auditTrailReadFailed: "audit.trail_read_failed",
   auditPersistFailed: "audit.persist_failed",
   auditQueryFailed: "audit.query_failed",
   economyRewardCredited: "economy.reward_credited",
   economyRewardSkipped: "economy.reward_skipped",
   economyDebitApplied: "economy.debit_applied",
   economyReservationApplied: "economy.reservation_applied",
   economyReleaseApplied: "economy.release_applied",
   economySettlementApplied: "economy.settlement_applied",
   economyReversalApplied: "economy.reversal_applied",
   economyAdminAdjusted: "economy.admin_adjusted",
   economyReconciliationDiscrepancy: "economy.reconciliation_discrepancy",

   pokemonSpeciesUpserted: "pokemon.species_upserted",
   pokemonGranted: "pokemon.granted",
   pokemonQueryFailed: "pokemon.query_failed",
   pokemonAcquisitionFailed: "pokemon.acquisition_failed",
   pokemonAcquired: "pokemon.acquired",
   pokemonBannerUpdated: "pokemon.banner_updated",

   yptClaimCreated: "ypt.claim_created",
   yptClaimApproved: "ypt.claim_approved",
   yptClaimRejected: "ypt.claim_rejected",
   yptSyncStarted: "ypt.sync_started",
   yptSyncCompleted: "ypt.sync_completed",
   yptSyncFailed: "ypt.sync_failed",

   trophyAwarded: "trophy.awarded",
   trophyDeducted: "trophy.deducted",
   trophyReversal: "trophy.reversal",
   rankChanged: "trophy.rank_changed",

   appError: "app.error",
} as const;

export type LogEventName = (typeof logEvents)[keyof typeof logEvents];
