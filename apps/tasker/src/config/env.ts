import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
   path: ["../../.env", ".env"],
   quiet: true,
});

const rawEnv: Record<string, string | undefined> = { ...process.env };

if (!rawEnv.DISCORD_BOT_TOKEN && rawEnv.DISCORD_TOKEN) {
   rawEnv.DISCORD_BOT_TOKEN = rawEnv.DISCORD_TOKEN;
   console.warn(
      "[tasker] DISCORD_TOKEN is deprecated. Rename it to DISCORD_BOT_TOKEN."
   );
}

if (!rawEnv.DISCORD_GUILD_ID && rawEnv.GUILD_ID) {
   rawEnv.DISCORD_GUILD_ID = rawEnv.GUILD_ID;
   console.warn(
      "[tasker] GUILD_ID is deprecated. Rename it to DISCORD_GUILD_ID."
   );
}

function booleanString(defaultValue: "true" | "false") {
   return z
      .enum(["true", "false"])
      .default(defaultValue)
      .transform((value) => value === "true");
}

const envSchema = z.object({
   NODE_ENV: z.string().default("development"),

   DISCORD_BOT_TOKEN: z.string().trim().min(1, "DISCORD_BOT_TOKEN is required"),
   DISCORD_GUILD_ID: z.string().trim().optional(),
   DISCORD_PREFIX: z.string().default("'"),
   DISCORD_ENABLE_PREFIX_COMMANDS: booleanString("true"),
   DISCORD_REGISTER_COMMANDS_ON_READY: booleanString("false"),

   DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
   DIRECT_URL: z.string().optional(),

   GEMINI_API_KEY: z.string().trim().optional(),
   GEMINI_API_KEY_2: z.string().trim().optional(),
   GEMINI_API_KEY_3: z.string().trim().optional(),
   GEMINI_MODEL: z.string().trim().optional(),

   WEB_APP_URL: z.string().url().default("https://holdmetoit.com"),
   PORT: z.coerce.number().int().positive().default(3001),

   TASKER_SOURCE_DATABASE_URL: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
   const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
   throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
