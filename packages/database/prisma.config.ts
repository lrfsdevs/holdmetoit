import "dotenv/config";
import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const url = directUrl ? directUrl : databaseUrl;

export default defineConfig({
   schema: "prisma/schema.prisma",
   migrations: {
      path: "prisma/migrations",
      seed: "tsx prisma/seed.ts",
   },
   ...(url ? { datasource: { url } } : {}),
});
