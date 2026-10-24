import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getGroupMembers } from "../../src/ypt/client.js";

const HOUR_MS = 60 * 60 * 1000;

function mockFetchWithMembers(members) {
   return async (url) => {
      if (url.includes("/logs/group/members/v2")) {
         return {
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ s: true, ms: members }),
         };
      }
      throw new Error(`Unexpected URL: ${url}`);
   };
}

describe("getGroupMembers session telemetry (raw, uncapped)", () => {
   const originalFetch = globalThis.fetch;

   afterEach(() => {
      globalThis.fetch = originalFetch;
   });

   it("exposes sessionStartMs and sessionElapsedMs for an ongoing 5h session (uncapped)", async () => {
      const now = Date.now();
      const sessionStart = now - 5 * HOUR_MS;

      globalThis.fetch = mockFetchWithMembers([
         {
            ud: 42,
            n: "LongSitter",
            ct: "Math",
            dl: {
               sm: 3600000,
               is: true,
               ip: false,
               ss: sessionStart,
               sn: "Calculus",
            },
         },
      ]);

      const members = await getGroupMembers("dummy-token", 101);
      const m = members[0];

      assert.strictEqual(m.userId, 42);
      assert.strictEqual(m.isStudying, true);
      assert.strictEqual(m.sessionStartMs, sessionStart);
      assert.ok(
         Math.abs(m.sessionElapsedMs - 5 * HOUR_MS) < 2000,
         "sessionElapsedMs should be ~5h"
      );

      // liveStudyMs stays raw (uncapped) at this layer: recorded + full session elapsed
      assert.strictEqual(m.liveStudyMs, 3600000 + m.sessionElapsedMs);
      assert.ok(
         m.liveStudyMs > 3600000 + 4 * HOUR_MS,
         "liveStudyMs must exceed the 4h session cap"
      );
   });

   it("reports a 1h session accurately without capping", async () => {
      const now = Date.now();
      const sessionStart = now - 1 * HOUR_MS;

      globalThis.fetch = mockFetchWithMembers([
         {
            ud: 7,
            n: "ShortSitter",
            ct: "Physics",
            dl: { sm: 3600000, is: true, ip: false, ss: sessionStart },
         },
      ]);

      const members = await getGroupMembers("dummy-token", 101);
      const m = members[0];

      assert.ok(
         Math.abs(m.sessionElapsedMs - HOUR_MS) < 2000,
         "sessionElapsedMs should be ~1h"
      );
      assert.strictEqual(m.liveStudyMs, 3600000 + m.sessionElapsedMs);
      assert.ok(
         Math.abs(m.liveStudyMs - 7200000) < 2000,
         "liveStudyMs should be ~2h"
      );
   });

   it("reports zero session elapsed when not studying", async () => {
      const now = Date.now();
      const sessionStart = now - 6 * HOUR_MS;

      globalThis.fetch = mockFetchWithMembers([
         {
            ud: 9,
            n: "Idle",
            ct: "Bio",
            dl: { sm: 1800000, is: false, ip: false, ss: sessionStart },
         },
      ]);

      const members = await getGroupMembers("dummy-token", 101);
      const m = members[0];

      assert.strictEqual(m.isStudying, false);
      assert.strictEqual(m.sessionElapsedMs, 0);
      assert.strictEqual(m.liveStudyMs, 1800000);
   });
});
