import { RolloutMode, UserRole, type PrismaClient } from "@prisma/client";

/**
 * Canonical system-level feature flags. They are seeded **DISABLED** so the
 * gated surfaces stay locked out until an operator enables them in the DevBoard.
 *
 * Re-running the seed never overwrites an operator's rollout changes:
 * the upsert uses an empty `update`.
 */
export const SYSTEM_FEATURE_FLAGS = [
   {
      key: "pokemon_system_v1",
      name: "Pokémon System",
      description:
         "Gates /pokemon, the header Pokédex link, and Pokémon summoning.",
   },
   {
      key: "betting_system_v1",
      name: "Betting System",
      description: "Gates the challenge betting card and new wager placements.",
   },
   {
      key: "global_leaderboard_v1",
      name: "Global Leaderboard",
      description:
         "Gates /leaderboard, trophy awards, and admin trophy adjustments.",
   },
   {
      key: "logrocket_v1",
      name: "LogRocket Session Replay",
      description:
         "Master switch for LogRocket initialization, session replay, event tracking, and feedback session URLs.",
   },
] as const;

export async function seedSystemFeatureFlags(prisma: PrismaClient) {
   // FeatureFlag.createdBy is a required FK (onDelete: Restrict). Prefer an
   // existing DEV/ADMIN, then any user; only create a seed user on an empty DB.
   const creator =
      (await prisma.user.findFirst({
         where: { role: { in: [UserRole.DEV, UserRole.ADMIN] } },
         orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })) ??
      (await prisma.user.create({
         data: {
            id: "seed-system-user",
            displayName: "System Seed",
            username: "system-seed",
            role: UserRole.DEV,
         },
      }));

   const flags = [];

   for (const flag of SYSTEM_FEATURE_FLAGS) {
      flags.push(
         await prisma.featureFlag.upsert({
            where: { key: flag.key },
            create: {
               key: flag.key,
               name: flag.name,
               description: flag.description,
               rolloutMode: RolloutMode.DISABLED,
               createdBy: creator.id,
            },
            update: {},
         })
      );
   }

   return flags;
}
