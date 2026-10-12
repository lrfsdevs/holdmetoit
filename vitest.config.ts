import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
   oxc: {
      jsx: { runtime: "automatic" },
   },
   test: {
      environment: "node",
      include: ["**/*.{test,spec}.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/prototype/**"],
   },
   resolve: {
      alias: {
         "@": path.resolve(__dirname, "."),
      },
   },
});
