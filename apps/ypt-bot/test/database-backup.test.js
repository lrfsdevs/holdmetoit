import { test, describe } from "node:test";
import assert from "node:assert";
import { writeFile } from "node:fs/promises";
import {
   buildObjectName,
   computeNextUtcMidnight,
   isBackupDue,
   parseObjectDate,
   parsePostgresUrl,
   pgClientMajor,
   runDatabaseBackup,
   selectExpiredObjects,
   serverMajorFromVersionNum,
} from "../src/backup/databaseBackup.js";

const BASE_CONFIG = {
   directUrl: "postgresql://postgres:secret@db.example.com:5432/postgres",
   supabaseUrl: "https://example.supabase.co",
   serviceRoleKey: "service-role-key",
   bucket: "holdmetoit-backups",
   prefix: "backups",
   schemas: "public",
   retentionDays: 30,
   pgDump: "pg_dump",
   pgRestore: "pg_restore",
   pgPsql: "psql",
};

function createLoggerStub() {
   const records = [];
   const push =
      (level) =>
      (message, meta = {}) => {
         records.push({ level, message, ...meta });
      };

   return {
      records,
      info: push("info"),
      warn: push("warn"),
      error: push("error"),
      child() {
         return this;
      },
   };
}

function createExec({
   dumpBytes = 1024,
   failDump = false,
   failRestore = false,
   clientVersion = 17,
   serverVersionNum = 170004,
} = {}) {
   const calls = [];

   const exec = async (command, args = [], options = {}) => {
      calls.push({ command, args, env: options.env || {} });

      if (args[0] === "--version") {
         return {
            stdout: `${command} (PostgreSQL) ${clientVersion}.2\n`,
            stderr: "",
         };
      }

      if (command === "psql") {
         return { stdout: `${serverVersionNum}\n`, stderr: "" };
      }

      if (args.includes("--list")) {
         if (failRestore) {
            throw new Error("pg_restore: error: could not read input file");
         }
         return { stdout: ";\n", stderr: "" };
      }

      if (failDump) {
         throw new Error("pg_dump exited with code 1: connection refused");
      }

      const fileIndex = args.indexOf("-f");
      await writeFile(args[fileIndex + 1], Buffer.alloc(dumpBytes, 1));
      return { stdout: "", stderr: "" };
   };

   return { exec, calls };
}

function createBucket({ objects = [], uploadError = null } = {}) {
   const state = { uploads: [], removed: [], lists: [] };

   return {
      state,
      async getBucket() {
         return { data: { id: "holdmetoit-backups" }, error: null };
      },
      async list(prefix, options = {}) {
         state.lists.push({ prefix, options });

         let data = objects.map((name) => ({ name, id: name }));
         if (options.search) {
            data = data.filter((object) =>
               object.name.includes(options.search)
            );
         }
         if (options.offset) data = data.slice(options.offset);
         if (options.limit) data = data.slice(0, options.limit);

         return { data, error: null };
      },
      async upload(path, body) {
         state.uploads.push({ path, size: body.length });
         if (uploadError) return { data: null, error: uploadError };
         return { data: { path }, error: null };
      },
      async remove(paths) {
         state.removed.push(...paths);
         return { data: paths, error: null };
      },
   };
}

describe("computeNextUtcMidnight", () => {
   test("returns the next UTC midnight", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-10-23T12:34:56.789Z")
         ).toISOString(),
         "2026-10-24T00:00:00.000Z"
      );
   });

   test("rolls forward when now is exactly midnight", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-10-23T00:00:00.000Z")
         ).toISOString(),
         "2026-10-24T00:00:00.000Z"
      );
   });

   test("handles month and year boundaries", () => {
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-01-31T23:59:59.999Z")
         ).toISOString(),
         "2026-02-01T00:00:00.000Z"
      );
      assert.strictEqual(
         computeNextUtcMidnight(
            new Date("2026-12-31T23:59:59.999Z")
         ).toISOString(),
         "2027-01-01T00:00:00.000Z"
      );
   });
});

describe("buildObjectName", () => {
   test("uses a day-scoped name for scheduled runs", () => {
      assert.strictEqual(
         buildObjectName(new Date("2026-10-23T00:00:00.000Z")),
         "holdmetoit-2026-10-23.dump"
      );
   });

   test("uses a timestamped name for manual runs", () => {
      assert.strictEqual(
         buildObjectName(new Date("2026-10-23T12:34:56.789Z"), {
            manual: true,
         }),
         "holdmetoit-2026-10-23T12-34-56Z.dump"
      );
   });
});

describe("parseObjectDate", () => {
   test("parses scheduled and manual object names", () => {
      assert.strictEqual(
         parseObjectDate("holdmetoit-2026-10-23.dump").toISOString(),
         "2026-10-23T00:00:00.000Z"
      );
      assert.strictEqual(
         parseObjectDate("holdmetoit-2026-10-23T12-34-56Z.dump").toISOString(),
         "2026-10-23T12:34:56.000Z"
      );
   });

   test("rejects unrelated and malformed names", () => {
      assert.strictEqual(parseObjectDate("notes.txt"), null);
      assert.strictEqual(parseObjectDate("holdmetoit-2026-13-01.dump"), null);
      assert.strictEqual(parseObjectDate("holdmetoit-2026-10-32.dump"), null);
   });
});

describe("isBackupDue", () => {
   const now = new Date("2026-10-23T12:00:00.000Z");

   test("is due when there is no previous backup", () => {
      assert.strictEqual(isBackupDue(now, null), true);
   });

   test("is not due within 24 hours", () => {
      assert.strictEqual(
         isBackupDue(now, new Date("2026-10-22T13:00:00.000Z")),
         false
      );
   });

   test("is due at or beyond 24 hours", () => {
      assert.strictEqual(
         isBackupDue(now, new Date("2026-10-22T12:00:00.000Z")),
         true
      );
   });
});

describe("selectExpiredObjects", () => {
   const now = new Date("2026-10-23T00:00:00.000Z");

   test("removes only objects older than the retention window", () => {
      const expired = selectExpiredObjects(
         [
            { name: "holdmetoit-2026-09-22.dump" },
            { name: "holdmetoit-2026-09-23.dump" },
            { name: "holdmetoit-2026-10-22.dump" },
            { name: "notes.txt" },
         ],
         now,
         30,
         "backups"
      );

      assert.deepStrictEqual(expired, ["backups/holdmetoit-2026-09-22.dump"]);
   });

   test("does nothing for invalid retention values", () => {
      assert.deepStrictEqual(
         selectExpiredObjects(
            [{ name: "holdmetoit-2020-01-01.dump" }],
            now,
            -1
         ),
         []
      );
   });
});

describe("version helpers", () => {
   test("parses pg_dump output", () => {
      assert.strictEqual(
         pgClientMajor("pg_dump (PostgreSQL) 17.2 (Debian 17.2-1.pgdg120+1)"),
         17
      );
   });

   test("converts server_version_num to a major version", () => {
      assert.strictEqual(serverMajorFromVersionNum("170004\n"), 17);
      assert.strictEqual(serverMajorFromVersionNum(""), null);
   });
});

describe("parsePostgresUrl", () => {
   test("decodes credentials and database name", () => {
      const parsed = parsePostgresUrl(
         "postgresql://postgres.abc:p%40ss@db.example.com:5432/postgres"
      );
      assert.deepStrictEqual(parsed, {
         host: "db.example.com",
         port: "5432",
         user: "postgres.abc",
         password: "p@ss",
         database: "postgres",
      });
   });

   test("rejects the transaction pooler", () => {
      assert.throws(
         () =>
            parsePostgresUrl(
               "postgresql://postgres:secret@db.example.com:6543/postgres"
            ),
         /transaction pooler/
      );
   });

   test("rejects non-postgres URLs", () => {
      assert.throws(
         () => parsePostgresUrl("https://example.com"),
         /must be a PostgreSQL/
      );
   });
});

describe("runDatabaseBackup", () => {
   const now = new Date("2026-10-23T00:00:00.000Z");

   test("dumps, verifies, uploads and prunes", async () => {
      const log = createLoggerStub();
      const { exec, calls } = createExec({ dumpBytes: 2048 });
      const bucket = createBucket({
         objects: ["holdmetoit-2026-09-01.dump", "holdmetoit-2026-10-22.dump"],
      });

      const result = await runDatabaseBackup({
         now,
         log,
         exec,
         bucket,
         config: BASE_CONFIG,
      });

      assert.strictEqual(result.skipped, false);
      assert.strictEqual(result.filename, "holdmetoit-2026-10-23.dump");
      assert.strictEqual(
         result.objectPath,
         "backups/holdmetoit-2026-10-23.dump"
      );
      assert.strictEqual(result.sizeBytes, 2048);
      assert.strictEqual(result.pruned, 1);
      assert.strictEqual(bucket.state.uploads.length, 1);
      assert.strictEqual(bucket.state.uploads[0].size, 2048);
      assert.deepStrictEqual(bucket.state.removed, [
         "backups/holdmetoit-2026-09-01.dump",
      ]);

      const dumpCall = calls.find((call) =>
         call.args.includes("--format=custom")
      );
      assert.ok(dumpCall, "pg_dump must run");
      assert.ok(dumpCall.args.includes("--no-owner"));
      assert.ok(dumpCall.args.includes("--no-privileges"));
      assert.deepStrictEqual(
         dumpCall.args.slice(
            dumpCall.args.indexOf("--schema"),
            dumpCall.args.indexOf("--schema") + 2
         ),
         ["--schema", "public"]
      );
      assert.strictEqual(dumpCall.env.PGPASSWORD, "secret");
      assert.ok(
         calls.every((call) => !call.args.includes("secret")),
         "password must never be a CLI argument"
      );
   });

   test("skips when the scheduled object already exists", async () => {
      const log = createLoggerStub();
      const { exec, calls } = createExec();
      const bucket = createBucket({
         objects: ["holdmetoit-2026-10-23.dump"],
      });

      const result = await runDatabaseBackup({
         now,
         log,
         exec,
         bucket,
         config: BASE_CONFIG,
      });

      assert.strictEqual(result.skipped, true);
      assert.strictEqual(bucket.state.uploads.length, 0);
      assert.ok(
         !calls.some((call) => call.args.includes("--format=custom")),
         "pg_dump must not run for an existing backup"
      );
   });

   test("rejects an empty dump", async () => {
      const log = createLoggerStub();
      const { exec } = createExec({ dumpBytes: 0 });
      const bucket = createBucket();

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec,
            bucket,
            config: BASE_CONFIG,
         }),
         /Backup file is empty/
      );
      assert.strictEqual(bucket.state.uploads.length, 0);
      assert.strictEqual(bucket.state.removed.length, 0);
   });

   test("does not upload when pg_dump fails", async () => {
      const log = createLoggerStub();
      const { exec } = createExec({ failDump: true });
      const bucket = createBucket();

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec,
            bucket,
            config: BASE_CONFIG,
         }),
         /connection refused/
      );
      assert.strictEqual(bucket.state.uploads.length, 0);
      assert.strictEqual(bucket.state.removed.length, 0);
   });

   test("does not upload when verification fails", async () => {
      const log = createLoggerStub();
      const { exec } = createExec({ failRestore: true });
      const bucket = createBucket();

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec,
            bucket,
            config: BASE_CONFIG,
         }),
         /could not read input file/
      );
      assert.strictEqual(bucket.state.uploads.length, 0);
   });

   test("does not prune when the upload fails", async () => {
      const log = createLoggerStub();
      const { exec } = createExec();
      const bucket = createBucket({
         objects: ["holdmetoit-2026-09-01.dump"],
         uploadError: { message: "network down", statusCode: 500 },
      });

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec,
            bucket,
            config: BASE_CONFIG,
         }),
         /Storage upload failed/
      );
      assert.strictEqual(bucket.state.removed.length, 0);
   });

   test("treats a duplicate upload as success and still prunes", async () => {
      const log = createLoggerStub();
      const { exec } = createExec();
      const bucket = createBucket({
         objects: ["holdmetoit-2026-09-01.dump"],
         uploadError: {
            message: "The resource already exists",
            statusCode: 409,
         },
      });

      const result = await runDatabaseBackup({
         now,
         log,
         exec,
         bucket,
         config: BASE_CONFIG,
      });

      assert.strictEqual(result.skipped, false);
      assert.strictEqual(result.pruned, 1);
   });

   test("aborts before dumping on a client/server version mismatch", async () => {
      const log = createLoggerStub();
      const { exec, calls } = createExec({ clientVersion: 14 });
      const bucket = createBucket();

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec,
            bucket,
            config: BASE_CONFIG,
         }),
         /cannot dump PostgreSQL 17/
      );
      assert.ok(
         !calls.some((call) => call.args.includes("--format=custom")),
         "pg_dump must not run on a version mismatch"
      );
   });

   test("fails fast on missing configuration", async () => {
      const log = createLoggerStub();

      await assert.rejects(
         runDatabaseBackup({
            now,
            log,
            exec: createExec().exec,
            bucket: createBucket(),
            config: {
               directUrl: "",
               supabaseUrl: "",
               serviceRoleKey: "",
               bucket: "",
            },
         }),
         /Missing backup environment variables/
      );
   });
});
