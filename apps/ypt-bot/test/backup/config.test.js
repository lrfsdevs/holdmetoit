import { test, describe } from "node:test";
import assert from "node:assert";
import { parsePostgresUrl } from "../../src/backup/config.js";

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
