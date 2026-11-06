import { z } from "zod";

const optionalString = z.preprocess(
   (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
   z.string().trim().optional()
);

const databaseEnvSchema = z.object({
   NODE_ENV: z.string().default("development"),
   DATABASE_URL: optionalString,
   DIRECT_URL: optionalString,
   DATABASE_SSL_CA: optionalString,
   DATABASE_SSL_REJECT_UNAUTHORIZED: z
      .string()
      .optional()
      .transform((val) => val === "true"),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

/** Single typed gateway for the shared database package. */
export function getDatabaseEnv(): DatabaseEnv {
   return databaseEnvSchema.parse(process.env);
}
