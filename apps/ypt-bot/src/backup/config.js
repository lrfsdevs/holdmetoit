import { env } from "../config/env.js";

/**
 * Parses the direct PostgreSQL URL into connection parts.
 * @param {string} rawUrl
 * @returns {{ host: string, port: string, user: string, password: string, database: string }}
 */
export function parsePostgresUrl(rawUrl) {
   let url;
   try {
      url = new URL(rawUrl);
   } catch {
      throw new Error("DIRECT_URL is not a valid URL");
   }

   if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("DIRECT_URL must be a PostgreSQL connection URL");
   }

   const isTransactionPooler =
      url.port === "6543" || url.searchParams.get("pgbouncer") === "true";

   if (isTransactionPooler) {
      throw new Error(
         "DIRECT_URL must be the direct/session connection (port 5432), not the transaction pooler"
      );
   }

   const decode = (value) => {
      try {
         return decodeURIComponent(value);
      } catch {
         return value;
      }
   };

   return {
      host: url.hostname,
      port: url.port || "5432",
      user: decode(url.username),
      password: decode(url.password),
      database: decode(url.pathname.replace(/^\//, "")) || "postgres",
   };
}

export function resolveConfig(overrides = {}) {
   return {
      directUrl: overrides.directUrl ?? env.DIRECT_URL,
      supabaseUrl: overrides.supabaseUrl ?? env.SUPABASE_URL,
      serviceRoleKey: overrides.serviceRoleKey ?? env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: overrides.bucket ?? env.SUPABASE_BACKUP_BUCKET,
      prefix: overrides.prefix ?? env.DATABASE_BACKUP_PREFIX,
      schemas: overrides.schemas ?? env.DATABASE_BACKUP_SCHEMAS,
      retentionDays:
         overrides.retentionDays ?? env.DATABASE_BACKUP_RETENTION_DAYS,
      pgDump: overrides.pgDump ?? env.PG_DUMP_BIN,
      pgRestore: overrides.pgRestore ?? env.PG_RESTORE_BIN,
      pgPsql: overrides.pgPsql ?? env.PG_PSQL_BIN,
   };
}

export function assertConfig(config) {
   const missing = [
      ["DIRECT_URL", config.directUrl],
      ["SUPABASE_URL", config.supabaseUrl],
      ["SUPABASE_SERVICE_ROLE_KEY", config.serviceRoleKey],
      ["SUPABASE_BACKUP_BUCKET", config.bucket],
   ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

   if (missing.length > 0) {
      throw new Error(
         `Missing backup environment variables: ${missing.join(", ")}`
      );
   }

   return {
      ...config,
      connection: parsePostgresUrl(config.directUrl),
      schemaList: String(config.schemas || "public")
         .split(",")
         .map((schema) => schema.trim())
         .filter(Boolean),
   };
}
