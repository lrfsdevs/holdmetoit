# Prisma Database Migrations Guide

> **Target Database:** PostgreSQL 15+ (Supabase / Neon)  
> **ORM & Tooling:** Prisma ORM 6.x (`prisma/schema.prisma`)  
> **Last Updated:** 2026-10-11

---

## 1. Applied Migration History

The repository tracks the following declarative migrations under `prisma/migrations/`:

| Migration Directory                                                   | Applied Date | Core Schema Delta                                                                                                                                                                                                                                                                                                                                                                                                      |
| :-------------------------------------------------------------------- | :----------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261003000000_baseline`                                             |  2026-10-03  | Baseline schema capturing initial Auth.js models (`User`, `Account`, `Session`, `VerificationToken`), `Challenge`, `Team`, `ChallengeParticipant`, `DailyStudyLog`, `WeeklyGoal`, `PunishmentRecord`, `team_members`, and `leaderboard_entries`.                                                                                                                                                                       |
| `20261004000000_add_event_banner_url`                                 |  2026-10-04  | Adds nullable `eventBannerUrl` to `Challenge` and backfills legacy values from `punishmentPfpUrl`.                                                                                                                                                                                                                                                                                                                     |
| `20261004010000_make_participant_team_optional`                       |  2026-10-04  | Allows `ChallengeParticipant.teamId` to be nullable (`SetNull` on delete), supporting unassigned/open challenge enrollment.                                                                                                                                                                                                                                                                                            |
| `20261004020000_remove_challenge_status`                              |  2026-10-04  | Drops `status` column and `ChallengeStatus` enum from database. Status (`UPCOMING`, `ACTIVE`, `COMPLETED`) is derived dynamically in application domain via `calculateChallengeStatus(startAt, endAt)`.                                                                                                                                                                                                                |
| `20261004030000_categorizable_todos`                                  |  2026-10-04  | Drops legacy `WeeklyGoal` table. Introduces user-scoped `categories` and `tasks` tables for flexible productivity tracking.                                                                                                                                                                                                                                                                                            |
| `20261005010000_add_task_type_to_categories`                          |  2026-10-05  | Adds `task_type` (`DAILY` or `WEEKLY`) to `categories` table with composite unique index `(userId, name, task_type)` to segregate daily and weekly boards.                                                                                                                                                                                                                                                             |
| `20261005020000_add_dev_user_role`                                    |  2026-10-05  | Extends `UserRole` enum with `DEV` for platform developer privilege gating via `DEV_DISCORD_IDS`.                                                                                                                                                                                                                                                                                                                      |
| `20261006000000_add_event_audit_logs`                                 |  2026-10-06  | Adds the append-only `audit_logs` table (`AuditLog` model) for the immutable system audit trail (FEAT-AUDIT-01).                                                                                                                                                                                                                                                                                                       |
| `20261010120000_add_is_leave_to_study_logs`                           |  2026-10-10  | Adds `isLeave` to daily study logs so leave days can be recorded without counting as study time.                                                                                                                                                                                                                                                                                                                       |
| `20261011000000_add_results_locked_at_to_challenge`                   |  2026-10-11  | Adds `resultsLockedAt` to `Challenge` (D1 fix) so hosts can finalize results idempotently even after natural expiry.                                                                                                                                                                                                                                                                                                   |
| `20261011120000_challenge_wrapped_flags_and_punishment_trim`          |  2026-10-11  | Adds `isWrappedSeen`/`isFeedbackFilled` to `ChallengeParticipant`. Trims `PunishmentRecord` to `id/challengeId/participantId/isPardoned/pardonReason/pardonedById/evaluatedAt/updatedAt` (drops `isPunished`, `hoursDeficitSeconds`, `incompleteGoalsCount`); removes the `participantId` unique (plain index instead) so records accumulate across challenges; deletes legacy non-punished rows (pardoned rows kept). |
| `20261011120100_challenge_linked_tasks_and_soft_delete`               |  2026-10-11  | Adds `challenge_id` (SetNull FK) + `deleted_at` to `tasks` and `deleted_at` to `categories` (soft delete; soft-deleted rows still count at challenge lock). Backfills all existing tasks to the current October challenge.                                                                                                                                                                                             |
| `20261013000000_add_soft_delete_to_challenges_teams_categories_tasks` |  2026-10-13  | Adds `is_deleted` and `deletion_time` across `Challenge`, `Team`, `categories`, and `tasks`. Indexes on soft delete status, renames legacy `deleted_at` to `deletion_time` and backfills `is_deleted = true`.                                                                                                                                                                                                          |
| `20261013010000_remove_manual_leaderboard_tables`                     |  2026-10-13  | Drops legacy manual leaderboard tables `leaderboard_entries` and `team_members` to resolve Law L8 Decimal deviation and eliminate duplicate join table ambiguity.                                                                                                                                                                                                                                                      |
| `20261014000000_standardize_tables_to_pascal_case`                    |  2026-10-14  | Renames `study_logs_v2`, `categories`, `tasks`, `feedbacks`, `challenge_feedbacks`, and `audit_logs` to `DailyStudyLogV2`, `Category`, `Task`, `Feedback`, `ChallengeFeedback`, and `AuditLog` to standardize 100% of application tables to PascalCase.                                                                                                                                                                |
| `20261014010000_standardize_columns_to_camel_case`                    |  2026-10-14  | Standardizes all database column names across `Challenge`, `Team`, `Category`, `Task`, `Feedback`, `ChallengeFeedback`, and `AuditLog` to `camelCase`, eliminating all `@map` column directives and making 100% of DB columns and TS properties match 1:1.                                                                                                                                                             |
| `20261014020000_unify_study_logs_and_add_leave_budget`                |  2026-10-14  | Drops legacy `DailyStudyLog` (V1) table, promotes `DailyStudyLogV2` to the canonical `DailyStudyLog` model, renames all legacy constraints/indexes, adds `plannedLeaveDays` and `usedLeaveDays` to `ChallengeParticipant`, and backfills existing leave counts.                                                                                                                                                        |
| `20261015000000_create_feature_flags`                                 |  2026-10-15  | Introduces `FeatureFlag`, `FeatureFlagTarget`, and `FeatureFlagAuditLog` models and `RolloutMode` enum for platform developer feature flagging and rollout controls.                                                                                                                                                                                                                                                   |
| `20261016000000_add_description_to_challenge`                         |  2026-10-16  | Adds nullable `description` column (`TEXT`) to `Challenge` table for dynamic challenge overview descriptions with graceful legacy fallback.                                                                                                                                                                                                                                                                            |
| `20261019000000_add_feedback_attachments`                             |  2026-10-19  | Adds `FeedbackAttachmentKind` enum and `FeedbackAttachment` table (URL/path/kind/mime/size/sort order) with a cascade FK to `Feedback`, plus unique `(feedbackId, path)` and `(feedbackId, sortOrder)` indexes.                                                                                                                                                                                                        |
| `20261019010000_add_feedback_github_issue`                            |  2026-10-19  | Adds `GitHubDeliveryStatus` enum and `githubStatus`/`githubIssueNumber`/`githubIssueUrl`/`githubSyncedAt` columns to `Feedback` for fail-soft GitHub issue synchronization, plus a `githubStatus` index.                                                                                                                                                                                                               |
| `20261019020000_add_feedback_jira_issue`                              |  2026-10-19  | Adds `JiraDeliveryStatus` enum and `jiraStatus`/`jiraIssueKey`/`jiraIssueUrl`/`jiraSyncedAt` columns to `Feedback` for fail-soft Jira Cloud issue synchronization, plus a `jiraStatus` index.                                                                                                                                                                                                                          |
| `20261029000000_team_active_name_ci_unique`                           |  2026-10-29  | Replaces the exact-case `Team_challengeId_name_key` unique index with a partial unique index on `(challengeId, LOWER(name)) WHERE "isDeleted" = false`, enforcing case-insensitive uniqueness only for active teams so soft-deleted names can be reused.                                                                                                                                                               |

---

## 2. Known Schema Drift & Remediation Notice

> [!WARNING]
> **Schema Drift Alert (`HANDOFF.md` Defect D5):**  
> Two subsequent features were synchronized to development databases using `prisma db push` without generating a migration directory:
>
> 1. `Feedback` model (`feedbacks` table with `feedback_number`, `type`, `status`, `discord_status`, etc.)
> 2. `sortOrder` integer columns (`sort_order`) on `categories` and `tasks` models.
>
> **Action Required for Fresh Databases:**  
> Running `npx prisma migrate deploy` on a fresh database will apply all tracked migrations, but will not create the `feedbacks` table or the `sort_order` columns. Until catch-up migration `20261006000000_add_feedback_and_sort_order` is generated and committed, developers setting up a fresh local database should run `npx prisma db push` to reconcile remaining models.

---

## 3. Standard Deployment Procedures

### 3.1 Fresh Database Deployment

To apply all tracked migrations to an empty PostgreSQL database:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

### 3.2 Existing Database Previously Created with `db push`

If a remote database was provisioned via `db push` and lacks migration history records in `_prisma_migrations`:

1. **Back up the database** first.
2. Mark the baseline and preceding migrations as applied:
   ```bash
   npx prisma migrate resolve --applied 20261003000000_baseline --schema prisma/schema.prisma
   npx prisma migrate resolve --applied 20261004000000_add_event_banner_url --schema prisma/schema.prisma
   # (continue for already-applied migrations)
   ```
3. Run `npx prisma migrate deploy` to execute any outstanding incremental migrations.
