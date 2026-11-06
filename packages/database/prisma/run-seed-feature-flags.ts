import { createPrismaClient, getDatabaseEnv } from "../src/index.js";

import { seedSystemFeatureFlags } from "./seed-feature-flags";

const env = getDatabaseEnv();
const seedUrl = env.DIRECT_URL ?? env.DATABASE_URL;

if (!seedUrl) {
   throw new Error(
      "Cannot seed feature flags: neither DIRECT_URL nor DATABASE_URL is set."
   );
}

const prisma = createPrismaClient(seedUrl);

async function main() {
   const flags = await seedSystemFeatureFlags(prisma);

   for (const flag of flags) {
      console.log(`- ${flag.key}: ${flag.rolloutMode}`);
   }
}

main()
   .catch((error) => {
      console.error("Feature flag seed failed:", error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
