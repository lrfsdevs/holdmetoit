import { z } from "zod";

const optionalString = z.preprocess(
   (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
   z.string().trim().optional()
);

const publicEnvSchema = z.object({
   NEXT_PUBLIC_SUPABASE_URL: optionalString,
   NEXT_PUBLIC_LOG_LEVEL: optionalString,
   NEXT_PUBLIC_LOGROCKET_APP_ID: optionalString,
   NEXT_PUBLIC_APP_RELEASE: optionalString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

// Next.js only inlines statically written NEXT_PUBLIC_* reads, so list each
// variable explicitly rather than spreading process.env.
const raw = {
   NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
   NEXT_PUBLIC_LOGROCKET_APP_ID: process.env.NEXT_PUBLIC_LOGROCKET_APP_ID,
   NEXT_PUBLIC_APP_RELEASE: process.env.NEXT_PUBLIC_APP_RELEASE,
};

const parsed = publicEnvSchema.safeParse(raw);

export const publicEnv: PublicEnv = parsed.success
   ? parsed.data
   : publicEnvSchema.parse({});
