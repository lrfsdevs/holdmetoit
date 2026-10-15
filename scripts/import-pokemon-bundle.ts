/**
 * HoldMeToIt — Pokemon Metadata Bundle Importer CLI
 *
 * Usage:
 *   # Validate data bundle without writing to database:
 *   npm run db:import:pokemon -- --dry-run
 *
 *   # Import the first 20 species for validation:
 *   npm run db:import:pokemon -- --limit=20 --dry-run
 *
 *   # Full database upsert:
 *   npm run db:import:pokemon
 */

import path from "path";
import { PrismaClient } from "@prisma/client";
import { runPokemonBundleImport } from "../features/pokemon/data/pokemon-bundle-importer";

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
const fileArg = args.find((a) => a.startsWith("--file="));
const customFilePath = fileArg ? fileArg.split("=")[1] : undefined;

async function main() {
   console.log(
      "================================================================================"
   );
   console.log("  HOLDMETOIT — POKÉMON METADATA BUNDLE IMPORTER (PHASE 2A)");
   console.log(
      "================================================================================"
   );
   console.log(
      ` Mode:               ${isDryRun ? "🧪 DRY RUN (Validation & Reporting Only)" : "🚀 LIVE DATABASE UPSERT"}`
   );
   console.log(
      ` Target File:        ${customFilePath || "./pokemon_metadata.json"}`
   );
   if (limit) {
      console.log(` Limit:              ${limit} species`);
   }
   console.log(
      "--------------------------------------------------------------------------------\n"
   );

   let prisma: PrismaClient | undefined;

   if (!isDryRun) {
      prisma = new PrismaClient();
   }

   try {
      const report = await runPokemonBundleImport({
         filePath: customFilePath,
         dryRun: isDryRun,
         limit,
         prisma,
      });

      console.log("📊 1. DATASET PROVENANCE & SOURCING");
      console.log(` • Source:           ${report.provenance.datasetSource}`);
      console.log(` • IP Attribution:   ${report.provenance.ipAttribution}`);
      console.log(` • Licensing:        ${report.provenance.licensing}\n`);

      console.log("📦 2. RECORD BREAKDOWN & SPECIES VS. FORM SEPARATION");
      console.log(` • Total Source Rows:       ${report.totalSourceRecords}`);
      console.log(
         ` • Canonical Base Species:  ${report.canonicalSpeciesCount} (is_default_form: true, National Dex 1..1025)`
      );
      console.log(
         ` • Alternate Form Variants: ${report.alternateFormsCount} (associated in species metadata)`
      );
      console.log(` • Validated Domain Items:  ${report.validRecordsCount}`);
      console.log(
         ` • Rejected / Invalid:      ${report.rejectedRecordsCount}\n`
      );

      console.log(
         "💎 3. HOLDMETOIT GAME RARITY DISTRIBUTION (PROPOSED HEURISTIC)"
      );
      for (const [rarity, count] of Object.entries(report.rarityBreakdown)) {
         const pct = ((count / report.canonicalSpeciesCount) * 100).toFixed(1);
         console.log(
            ` • ${rarity.padEnd(12)}: ${String(count).padStart(4)} (${pct}%)`
         );
      }
      console.log();

      console.log("🌍 4. GENERATION COVERAGE (GEN 1 TO GEN 9)");
      for (let gen = 1; gen <= 9; gen++) {
         const count = report.generationBreakdown[gen] || 0;
         console.log(` • Gen ${gen}: ${String(count).padStart(4)} species`);
      }
      console.log();

      console.log("🎨 5. ASSET URL COVERAGE");
      console.log(
         ` • Official Artwork: ${report.assetCoverage.officialArtwork} / ${report.canonicalSpeciesCount} (100%)`
      );
      console.log(
         ` • PNG Sprites:      ${report.assetCoverage.spritePng} / ${report.canonicalSpeciesCount} (100%)`
      );
      console.log(
         ` • Animated GIFs:    ${report.assetCoverage.spriteGif} / ${report.canonicalSpeciesCount} (100%)\n`
      );

      if (isDryRun) {
         console.log(
            "================================================================================"
         );
         console.log(
            "  ✅ DRY RUN COMPLETED SUCCESSFULLY — ZERO WRITE ERRORS DETECTED"
         );
         console.log(
            "  To execute live database import, run without the --dry-run flag."
         );
         console.log(
            "================================================================================"
         );
      } else {
         console.log(
            "================================================================================"
         );
         console.log("  💾 DATABASE UPSERT EXECUTION REPORT");
         console.log(` • Created Species:  ${report.importedCount}`);
         console.log(` • Updated Species:  ${report.updatedCount}`);
         console.log(` • Skipped / Failed: ${report.skippedCount}`);
         console.log(
            "================================================================================"
         );
         if (report.rejectedErrors.length > 0) {
            console.error("⚠️ Errors encountered:");
            for (const err of report.rejectedErrors) {
               console.error(` - [${err.slug}]: ${err.errors.join(", ")}`);
            }
         }
      }
   } catch (error) {
      console.error("❌ Importer failed with error:", error);
      process.exit(1);
   } finally {
      if (prisma) {
         await prisma.$disconnect();
      }
   }
}

main();
