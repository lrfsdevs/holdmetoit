import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHealthServer } from "../../src/http/health-server.js";

const servers = [];

async function startServer() {
   const server = createHealthServer();
   servers.push(server);

   await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });

   const { port } = server.address();
   return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
   await Promise.all(
      servers.splice(0).map(
         (server) =>
            new Promise((resolve) => {
               server.close(() => resolve());
            })
      )
   );
});

describe("createHealthServer", () => {
   test("GET /health returns the liveness payload", async () => {
      const baseUrl = await startServer();

      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(body.status, "ok");
      assert.equal(body.service, "ypt-bot");
      assert.equal(typeof body.uptimeSeconds, "number");
   });

   test("HEAD /health mirrors GET headers with an empty body", async () => {
      const baseUrl = await startServer();

      const getResponse = await fetch(`${baseUrl}/health`);
      const getBody = await getResponse.text();

      const response = await fetch(`${baseUrl}/health`, { method: "HEAD" });
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(
         response.headers.get("content-length"),
         String(Buffer.byteLength(getBody))
      );
      assert.equal(body, "");
   });

   test("GET /health ignores query strings", async () => {
      const baseUrl = await startServer();

      const response = await fetch(`${baseUrl}/health?probe=1`);

      assert.equal(response.status, 200);
   });

   test("unknown paths return 404", async () => {
      const baseUrl = await startServer();

      const response = await fetch(`${baseUrl}/unknown`);
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.deepEqual(body, { error: "Not found" });
   });

   test("non-GET/HEAD methods on /health return 404", async () => {
      const baseUrl = await startServer();

      const response = await fetch(`${baseUrl}/health`, { method: "POST" });

      assert.equal(response.status, 404);
   });
});
