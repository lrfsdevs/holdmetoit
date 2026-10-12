/**
 * Local-only ops script: link all users' tasks to a challenge (default: the
 * October challenge). Idempotent — without --force it only touches tasks that
 * have no challenge yet. Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   npm run db:link-tasks                       # dry run, auto-resolve October
 *   npm run db:link-tasks -- --apply            # link unlinked tasks
 *   npm run db:link-tasks -- --force --apply    # relink every task to October
 *   npm run db:link-tasks -- --challenge-id <id> --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CliOptions {
   challengeId?: string;
   apply: boolean;
   force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
   const options: CliOptions = { apply: false, force: false };

   for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];

      if (arg === "--apply") {
         options.apply = true;
      } else if (arg === "--force") {
         options.force = true;
      } else if (arg === "--challenge-id") {
         const value = argv[index + 1];
         if (!value) {
            throw new Error("--challenge-id requires a value.");
         }
         options.challengeId = value;
         index += 1;
      } else {
         throw new Error(`Unknown argument: ${arg}`);
      }
   }

   return options;
}

function resolveLocalDatabaseHost(): string {
   const url = process.env.DATABASE_URL;
   if (!url) {
      throw new Error(
         "DATABASE_URL is not set. Run through an npm script (--env-file=.env) or export it first."
      );
   }

   let host: string;
   try {
      host = new URL(url).hostname;
   } catch {
      throw new Error("DATABASE_URL could not be parsed as a connection URL.");
   }

   const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
   if (!localHosts.has(host)) {
      throw new Error(
         `Refusing to run against non-local database host "${host}". These ops scripts are local-only.`
      );
   }

   return host;
}

async function resolveTargetChallenge(options: CliOptions) {
   if (options.challengeId) {
      const challenge = await prisma.challenge.findUnique({
         where: { id: options.challengeId },
      });
      if (!challenge) {
         throw new Error(`Challenge "${options.challengeId}" was not found.`);
      }
      return challenge;
   }

   const candidates = await prisma.challenge.findMany({
      where: { title: { contains: "october", mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
   });

   if (candidates.length === 0) {
      throw new Error(
         'No challenge with "October" in its title was found. Pass --challenge-id <id>.'
      );
   }

   const now = new Date();
   const running = candidates.find(
      (challenge) => challenge.startAt <= now && now <= challenge.endAt
   );

   return running ?? candidates[0];
}

async function main(): Promise<void> {
   const options = parseArgs(process.argv.slice(2));
   const host = resolveLocalDatabaseHost();

   console.log(`Database host: ${host}`);
   console.log(
      options.apply ? "Mode: APPLY" : "Mode: dry run (pass --apply to write)"
   );

   const challenge = await resolveTargetChallenge(options);
   console.log(`Target challenge: "${challenge.title}" (${challenge.id})`);
   console.log(
      `  starts ${challenge.startAt.toISOString()} · ends ${challenge.endAt.toISOString()}`
   );

   const [total, alreadyOnTarget, unlinked] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { challengeId: challenge.id } }),
      prisma.task.count({ where: { challengeId: null } }),
   ]);
   const linkedElsewhere = total - alreadyOnTarget - unlinked;

   console.log(
      `Tasks: ${total} total · ${alreadyOnTarget} already on target · ${unlinked} unlinked · ${linkedElsewhere} linked elsewhere`
   );

   const where = options.force
      ? {
           OR: [{ challengeId: null }, { challengeId: { not: challenge.id } }],
        }
      : { challengeId: null };

   if (!options.apply) {
      console.log(
         options.force
            ? "Dry run — --apply would relink ALL tasks (unlinked + elsewhere) to the target."
            : "Dry run — --apply would link the unlinked tasks only (use --force to relink everything)."
      );
      return;
   }

   const result = await prisma.task.updateMany({
      where,
      data: { challengeId: challenge.id },
   });

   console.log(
      `Done — linked ${result.count} task(s) to "${challenge.title}".`
   );
}

main()
   .catch((error) => {
      console.error(
         `Task link failed: ${error instanceof Error ? error.message : error}`
      );
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
