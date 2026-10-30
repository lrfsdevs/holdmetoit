/**
 * HoldMeToIt — Results-lock concurrency verifier (local / staging only)
 *
 * Proves the two invariants introduced by the lock hardening:
 *   1. Two concurrent lockChallengeResults calls: exactly one succeeds.
 *   2. A participant can have at most one PunishmentRecord per challenge.
 *
 * WARNING: this locks a real challenge and writes punishment records.
 * Use a disposable local/staging challenge. It refuses to run against a
 * non-local DATABASE_URL unless `--force-host` is passed.
 *
 * Usage (from apps/web):
 *   npx tsx --env-file=.env scripts/verify-lock-concurrency.ts --challenge=<id> --dry-run
 *   npx tsx --env-file=.env scripts/verify-lock-concurrency.ts --challenge=<id> --apply
 *   npx tsx --env-file=.env scripts/verify-lock-concurrency.ts --challenge=<id> --apply --force-host
 */

import { PrismaClient } from "@prisma/client";
import { lockChallengeResults } from "../features/challenges/data/challenge-admin.repository";

const prisma = new PrismaClient();

const LOCAL_HOSTS = new Set([
   "localhost",
   "127.0.0.1",
   "::1",
   "db",
   "postgres",
   "host.docker.internal",
]);

function isLocalDatabase(url: string | undefined): boolean {
   if (!url) return false;
   try {
      return LOCAL_HOSTS.has(new URL(url).hostname);
   } catch {
      return false;
   }
}

function getArg(name: string): string | undefined {
   const prefix = `--${name}=`;
   return process.argv
      .find((arg) => arg.startsWith(prefix))
      ?.slice(prefix.length);
}

async function main() {
   const challengeId = getArg("challenge");
   const apply = process.argv.includes("--apply");
   const forceHost = process.argv.includes("--force-host");
   const dryRun = process.argv.includes("--dry-run");

   if (!challengeId) {
      throw new Error("Pass --challenge=<id>.");
   }
   if (!dryRun && !apply) {
      throw new Error("Pass --dry-run to inspect or --apply to run the race.");
   }
   if (apply && !isLocalDatabase(process.env.DATABASE_URL) && !forceHost) {
      throw new Error(
         "Refusing to --apply against a non-local database. Pass --force-host if certain."
      );
   }

   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
         id: true,
         title: true,
         resultsLockedAt: true,
         isDeleted: true,
      },
   });

   if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found.`);
   }

   console.log(
      `Challenge "${challenge.title}" locked=${challenge.resultsLockedAt != null} deleted=${challenge.isDeleted}`
   );

   if (dryRun) {
      const participantCount = await prisma.challengeParticipant.count({
         where: { challengeId },
      });
      const duplicateGroups = await prisma.$queryRaw<
         { challengeId: string; participantId: string; count: bigint }[]
      >`
         SELECT "challengeId", "participantId", COUNT(*) AS count
         FROM "PunishmentRecord"
         WHERE "challengeId" = ${challengeId}
         GROUP BY 1, 2
         HAVING COUNT(*) > 1
      `;

      console.log(`Participants: ${participantCount}`);
      console.log(`Duplicate punishment groups: ${duplicateGroups.length}`);
      console.log("Dry run only. Re-run with --apply to race the lock.");
      return;
   }

   const actor = {
      id: "concurrency-verifier",
      username: "concurrency-verifier",
   };
   const results = await Promise.allSettled([
      lockChallengeResults(challengeId, actor),
      lockChallengeResults(challengeId, actor),
   ]);

   const fulfilled = results.filter((r) => r.status === "fulfilled").length;
   const rejected = results.filter((r) => r.status === "rejected").length;

   console.log(`Fulfilled: ${fulfilled}  Rejected: ${rejected}`);
   for (const result of results) {
      if (result.status === "rejected") {
         console.log(
            `  rejection: ${
               result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason)
            }`
         );
      }
   }

   const duplicateGroups = await prisma.$queryRaw<
      { challengeId: string; participantId: string; count: bigint }[]
   >`
      SELECT "challengeId", "participantId", COUNT(*) AS count
      FROM "PunishmentRecord"
      WHERE "challengeId" = ${challengeId}
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
   `;

   const lockAudits = await prisma.auditLog.count({
      where: { challengeId, actionType: "CHALLENGE_LOCKED" },
   });

   const finalChallenge = await prisma.challenge.findUniqueOrThrow({
      where: { id: challengeId },
      select: { resultsLockedAt: true },
   });

   console.log(`Duplicate punishment groups: ${duplicateGroups.length}`);
   console.log(`CHALLENGE_LOCKED audit rows: ${lockAudits}`);
   console.log(
      `resultsLockedAt: ${finalChallenge.resultsLockedAt?.toISOString() ?? "null"}`
   );

   const violations: string[] = [];
   if (fulfilled !== 1)
      violations.push(`expected 1 fulfilled, got ${fulfilled}`);
   if (duplicateGroups.length > 0)
      violations.push(
         `${duplicateGroups.length} duplicate punishment group(s)`
      );
   if (finalChallenge.resultsLockedAt == null)
      violations.push("resultsLockedAt was not set");

   if (violations.length > 0) {
      console.error("\nINVARIANT VIOLATIONS:");
      for (const violation of violations) console.error(`  - ${violation}`);
      process.exitCode = 1;
      return;
   }

   console.log("\nAll lock invariants hold.");
}

main()
   .catch((error) => {
      console.error("Verification failed:", error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
