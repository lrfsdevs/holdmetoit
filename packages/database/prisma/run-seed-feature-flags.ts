import { PrismaClient } from "@prisma/client";

import { seedSystemFeatureFlags } from "./seed-feature-flags";

const prisma = new PrismaClient();

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
