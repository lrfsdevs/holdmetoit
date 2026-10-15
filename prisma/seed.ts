import { PrismaClient } from "@prisma/client";
import { seedPokemonCatalogue } from "./seed-pokemon";

const prisma = new PrismaClient();

/** Deterministic seed identifier for idempotent upserts. */
export const SEED_CHALLENGE_ID = "seed-honey-bees-vs-lavender-butterflies";

const SEED_TEAM_BEES_ID = "seed-team-honey-bees";
const SEED_TEAM_BUTTERFLIES_ID = "seed-team-lavender-butterflies";

async function main() {
   const startAt = new Date("2026-09-01T08:00:00.000Z");
   const endAt = new Date("2026-09-08T08:00:00.000Z");

   const challenge = await prisma.challenge.upsert({
      where: { id: SEED_CHALLENGE_ID },
      create: {
         id: SEED_CHALLENGE_ID,
         eventBannerUrl: "/assets/challenge_hero_battle.jpg",
         title: "Midterm Reading Week Sprint",
         format: "TEAM_VS_TEAM",
         startAt,
         endAt,
         punishmentPfpUrl: "/prototype/assets/punishment_pfp.jpg",
      },
      update: {
         eventBannerUrl: "/assets/challenge_hero_battle.jpg",
         title: "Midterm Reading Week Sprint",
         format: "TEAM_VS_TEAM",
         startAt,
         endAt,
         punishmentPfpUrl: "/prototype/assets/punishment_pfp.jpg",
      },
   });

   await prisma.team.upsert({
      where: { id: SEED_TEAM_BEES_ID },
      create: {
         id: SEED_TEAM_BEES_ID,
         challengeId: challenge.id,
         name: "Honey Bees",
         iconEmoji: "🐝",
         color: "#d9822b",
         maxMembers: null,
         sortOrder: 0,
      },
      update: {
         name: "Honey Bees",
         iconEmoji: "🐝",
         color: "#d9822b",
         maxMembers: null,
         sortOrder: 0,
      },
   });

   await prisma.team.upsert({
      where: { id: SEED_TEAM_BUTTERFLIES_ID },
      create: {
         id: SEED_TEAM_BUTTERFLIES_ID,
         challengeId: challenge.id,
         name: "Lavender Butterflies",
         iconEmoji: "🦋",
         color: "#9986b8",
         maxMembers: null,
         sortOrder: 1,
      },
      update: {
         name: "Lavender Butterflies",
         iconEmoji: "🦋",
         color: "#9986b8",
         maxMembers: null,
         sortOrder: 1,
      },
   });

   // Seed sample categories & tasks for existing users if they have none
   const existingUsers = await prisma.user.findMany();
   for (const user of existingUsers) {
      const existingCats = await prisma.category.findMany({
         where: { userId: user.id },
      });
      if (existingCats.length === 0) {
         const defaultCategory = await prisma.category.create({
            data: {
               userId: user.id,
               name: "Deep Work",
            },
         });
         await prisma.task.createMany({
            data: [
               {
                  userId: user.id,
                  categoryId: defaultCategory.id,
                  challengeId: challenge.id,
                  title: "Complete 2 hours of focused study",
                  taskType: "DAILY",
                  isComplete: false,
               },
               {
                  userId: user.id,
                  categoryId: defaultCategory.id,
                  challengeId: challenge.id,
                  title: "Review weekly lecture notes",
                  taskType: "WEEKLY",
                  isComplete: false,
               },
            ],
         });
      }
   }

   // Seed Pokemon Species Catalogue (Phase 3)
   await seedPokemonCatalogue(prisma);

   console.log(
      `Seed complete: challenge "${challenge.title}" (${challenge.id}) with Honey Bees vs Lavender Butterflies and sample user tasks.`
   );
}

main()
   .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
