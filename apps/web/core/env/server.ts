import { z } from "zod";

const optionalString = z.preprocess(
   (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
   z.string().trim().optional()
);

const optionalBooleanString = z.preprocess(
   (value) => (value === undefined || value === "" ? undefined : value),
   z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
);

const serverEnvSchema = z.object({
   NODE_ENV: z.string().default("development"),
   DATABASE_URL: optionalString,
   DIRECT_URL: optionalString,

   AUTH_SECRET: optionalString,
   AUTH_URL: optionalString,
   AUTH_DISCORD_ID: optionalString,
   AUTH_DISCORD_SECRET: optionalString,
   ALLOW_DEV_BYPASS: optionalBooleanString,

   DISCORD_BOT_TOKEN: optionalString,
   DISCORD_GUILD_ID: optionalString,
   DISCORD_ADMIN_ROLE_IDS: optionalString,
   DEV_DISCORD_IDS: optionalString,
   DISCORD_DEV_IDS: optionalString,
   DISCORD_CLIENT_ID: optionalString,
   DISCORD_CLIENT_SECRET: optionalString,
   DISCORD_FEEDBACK_BUG_CHANNEL_ID: optionalString,
   DISCORD_FEEDBACK_CHANNEL_ID: optionalString,
   DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID: optionalString,
   DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID: optionalString,

   SUPABASE_URL: optionalString,
   SUPABASE_SERVICE_ROLE_KEY: optionalString,
   SUPABASE_STORAGE_BUCKET: optionalString,
   SUPABASE_EVENT_BANNERS_FOLDER: optionalString,
   SUPABASE_PUNISHMENT_PFPS_FOLDER: optionalString,
   SUPABASE_FEEDBACK_ATTACHMENTS_FOLDER: optionalString,

   YPT_INGEST_API_KEY: optionalString,
   YPT_EMAIL: optionalString,
   YPT_PASSWORD: optionalString,
   YPT_GROUP_IDS: optionalString,

   JIRA_BASE_URL: optionalString,
   JIRA_EMAIL: optionalString,
   JIRA_API_TOKEN: optionalString,
   JIRA_PROJECT_KEY: optionalString,
   JIRA_ASSIGNEE_ACCOUNT_ID: optionalString,
   JIRA_LABELS: optionalString,

   GITHUB_TOKEN: optionalString,
   GITHUB_REPO: optionalString,
   GITHUB_API_URL: optionalString,
   GITHUB_ISSUE_LABELS_BUG: optionalString,
   GITHUB_ISSUE_LABELS_ENHANCEMENT: optionalString,
   GITHUB_ISSUE_ASSIGNEES: optionalString,

   LOG_LEVEL: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses the current process environment on demand. Parsing per call keeps
 * tests that mutate process.env between cases working, while giving all server
 * code a single typed gateway.
 */
export function getServerEnv(): ServerEnv {
   return serverEnvSchema.parse(process.env);
}
