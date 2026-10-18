import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

/**
 * Helper to parse comma-separated string into string array
 * @param {string} val
 * @returns {string[]}
 */
function parseArray(val) {
   if (!val) return [];
   return String(val)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
}

/**
 * Helper to parse integer with fallback
 * @param {string} val
 * @param {number} fallback
 * @returns {number}
 */
function parseIntFallback(val, fallback) {
   const parsed = parseInt(val, 10);
   return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Centralized Single Point of Contact (SPOC) for all environment configuration
 */
export const env = Object.freeze({
   NODE_ENV: process.env.NODE_ENV || "development",

   LOG_LEVEL: (process.env.LOG_LEVEL || "info").toLowerCase(),
   LOG_SILENT: String(process.env.LOG_SILENT || "").toLowerCase() === "true",

   DATABASE_URL: process.env.DATABASE_URL || "",
   DIRECT_URL: process.env.DIRECT_URL || "",

   YPT_EMAIL: (process.env.YPT_EMAIL || "").trim(),
   YPT_PASSWORD: (process.env.YPT_PASSWORD || "").trim(),

   YPT_GROUP_IDS: parseArray(process.env.YPT_GROUP_IDS),

   PORT: parseIntFallback(process.env.PORT, 3000),

   POLL_INTERVAL_IDLE_SEC: parseIntFallback(
      process.env.POLL_INTERVAL_IDLE_SEC,
      30
   ),

   STALE_STUDY_TIMEOUT_MINUTES: parseIntFallback(
      process.env.STALE_STUDY_TIMEOUT_MINUTES,
      120
   ),

   TIMEZONE: process.env.TIMEZONE || "Asia/Kolkata",
   DAY_ROLLOVER_HOUR: parseIntFallback(process.env.DAY_ROLLOVER_HOUR, 5),

   ACTIVE_CHALLENGE_ID: process.env.ACTIVE_CHALLENGE_ID
      ? process.env.ACTIVE_CHALLENGE_ID.trim()
      : null,
});

export default env;
