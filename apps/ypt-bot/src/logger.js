import winston from "winston";
import { env } from "./config/env.js";

const isProd = env.NODE_ENV === "production";

const jsonFormat = winston.format.combine(
   winston.format.timestamp(),
   winston.format.errors({ stack: true }),
   winston.format.json()
);

const prettyFormat = winston.format.combine(
   winston.format.colorize(),
   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
   winston.format.errors({ stack: true }),
   winston.format.printf(
      ({ timestamp, level, message, stack, service, ...meta }) => {
         const ctx = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
         return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ""}${ctx}`;
      }
   )
);

/**
 * Builds a winston logger. Exposed as a factory so tests can inject a transport/format.
 * @param {object} [options]
 * @param {string} [options.level]
 * @param {boolean} [options.silent]
 * @param {import('winston').transport[]} [options.transports]
 * @param {import('winston').Logform.Format} [options.format]
 * @returns {import('winston').Logger}
 */
export function createLogger({
   level = env.LOG_LEVEL,
   silent = env.LOG_SILENT,
   transports,
   format,
} = {}) {
   return winston.createLogger({
      level,
      silent,
      defaultMeta: { service: "ypt-checker" },
      format: format ?? (isProd ? jsonFormat : prettyFormat),
      transports: transports ?? [
         new winston.transports.Console({ stderrLevels: ["error"] }),
      ],
   });
}

export const logger = createLogger();

export default logger;
