-- Standardize database column names to camelCase across all models

-- 1. Challenge
ALTER TABLE "Challenge" RENAME COLUMN "is_deleted" TO "isDeleted";
ALTER TABLE "Challenge" RENAME COLUMN "deletion_time" TO "deletionTime";

-- 2. Team
ALTER TABLE "Team" RENAME COLUMN "is_deleted" TO "isDeleted";
ALTER TABLE "Team" RENAME COLUMN "deletion_time" TO "deletionTime";

-- 3. Category
ALTER TABLE "Category" RENAME COLUMN "task_type" TO "taskType";
ALTER TABLE "Category" RENAME COLUMN "sort_order" TO "sortOrder";
ALTER TABLE "Category" RENAME COLUMN "is_deleted" TO "isDeleted";
ALTER TABLE "Category" RENAME COLUMN "deletion_time" TO "deletionTime";

-- 4. Task
ALTER TABLE "Task" RENAME COLUMN "challenge_id" TO "challengeId";
ALTER TABLE "Task" RENAME COLUMN "task_type" TO "taskType";
ALTER TABLE "Task" RENAME COLUMN "sort_order" TO "sortOrder";
ALTER TABLE "Task" RENAME COLUMN "is_complete" TO "isComplete";
ALTER TABLE "Task" RENAME COLUMN "due_date" TO "dueDate";
ALTER TABLE "Task" RENAME COLUMN "is_deleted" TO "isDeleted";
ALTER TABLE "Task" RENAME COLUMN "deletion_time" TO "deletionTime";
ALTER TABLE "Task" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "Task" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "Task" RENAME COLUMN "completed_at" TO "completedAt";

-- 5. Feedback
ALTER TABLE "Feedback" RENAME COLUMN "feedback_number" TO "feedbackNumber";
ALTER TABLE "Feedback" RENAME COLUMN "logrocket_session_id" TO "logrocketSessionId";
ALTER TABLE "Feedback" RENAME COLUMN "discord_status" TO "discordStatus";
ALTER TABLE "Feedback" RENAME COLUMN "discord_message_id" TO "discordMessageId";
ALTER TABLE "Feedback" RENAME COLUMN "discord_channel_id" TO "discordChannelId";
ALTER TABLE "Feedback" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "Feedback" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "Feedback" RENAME COLUMN "updated_at" TO "updatedAt";

-- 6. ChallengeFeedback
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "challenge_id" TO "challengeId";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "fairness_rating" TO "fairnessRating";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "tracking_preference" TO "trackingPreference";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "team_battle_feedback" TO "teamBattleFeedback";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "work_school_hours" TO "workSchoolHours";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "solo_style" TO "soloStyle";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "solo_punishment" TO "soloPunishment";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "solo_ideas" TO "soloIdeas";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "discord_message_id" TO "discordMessageId";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ChallengeFeedback" RENAME COLUMN "updated_at" TO "updatedAt";

-- 7. AuditLog
ALTER TABLE "AuditLog" RENAME COLUMN "challenge_id" TO "challengeId";
ALTER TABLE "AuditLog" RENAME COLUMN "actor_id" TO "actorId";
ALTER TABLE "AuditLog" RENAME COLUMN "actor_username" TO "actorUsername";
ALTER TABLE "AuditLog" RENAME COLUMN "actor_display_name" TO "actorDisplayName";
ALTER TABLE "AuditLog" RENAME COLUMN "actor_image" TO "actorImage";
ALTER TABLE "AuditLog" RENAME COLUMN "action_type" TO "actionType";
ALTER TABLE "AuditLog" RENAME COLUMN "target_entity_id" TO "targetEntityId";
ALTER TABLE "AuditLog" RENAME COLUMN "target_entity_type" TO "targetEntityType";
ALTER TABLE "AuditLog" RENAME COLUMN "target_entity_name" TO "targetEntityName";
ALTER TABLE "AuditLog" RENAME COLUMN "previous_value" TO "previousValue";
ALTER TABLE "AuditLog" RENAME COLUMN "new_value" TO "newValue";
ALTER TABLE "AuditLog" RENAME COLUMN "audit_reason" TO "auditReason";
ALTER TABLE "AuditLog" RENAME COLUMN "created_at" TO "createdAt";
