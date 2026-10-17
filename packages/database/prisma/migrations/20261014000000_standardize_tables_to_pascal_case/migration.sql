-- Standardize database table names to PascalCase across all models

ALTER TABLE IF EXISTS "study_logs_v2" RENAME TO "DailyStudyLogV2";
ALTER TABLE IF EXISTS "categories" RENAME TO "Category";
ALTER TABLE IF EXISTS "tasks" RENAME TO "Task";
ALTER TABLE IF EXISTS "feedbacks" RENAME TO "Feedback";
ALTER TABLE IF EXISTS "challenge_feedbacks" RENAME TO "ChallengeFeedback";
ALTER TABLE IF EXISTS "audit_logs" RENAME TO "AuditLog";
