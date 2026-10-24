import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getAggregatedMembers } from "../../src/ypt/client.js";

describe("getAggregatedMembers", () => {
   const originalFetch = globalThis.fetch;

   afterEach(() => {
      globalThis.fetch = originalFetch;
   });

   it("handles empty groups array gracefully", async () => {
      const res = await getAggregatedMembers("dummy-token", []);
      assert.deepEqual(res, {
         members: [],
         totalRawCount: 0,
         duplicatesRemoved: 0,
         successfulGroups: 0,
      });
   });

   it("aggregates members across 2 groups and removes duplicates", async () => {
      const mockGroups = [
         { id: 101, name: "Study Group 1" },
         { id: 202, name: "Study Group 2" },
      ];

      globalThis.fetch = async (url) => {
         if (url.includes("groupID=101")) {
            return {
               ok: true,
               headers: { get: () => "application/json" },
               json: async () => ({
                  s: true,
                  ms: [
                     {
                        ud: 1,
                        n: "Alice",
                        ct: "Math",
                        dl: { sm: 3600000, is: false, ip: false },
                     },
                     {
                        ud: 2,
                        n: "Bob",
                        ct: "Physics",
                        dl: { sm: 7200000, is: true, ip: false, sn: "Quantum" },
                     },
                  ],
               }),
            };
         }

         if (url.includes("groupID=202")) {
            return {
               ok: true,
               headers: { get: () => "application/json" },
               json: async () => ({
                  s: true,
                  ms: [
                     {
                        // Duplicate Alice: has more study time in Group 2
                        ud: 1,
                        n: "Alice",
                        ct: "Math",
                        dl: {
                           sm: 5400000,
                           is: true,
                           ip: false,
                           sn: "Linear Algebra",
                        },
                     },
                     {
                        // Charlie only in Group 2
                        ud: 3,
                        n: "Charlie",
                        ct: "Chemistry",
                        dl: { sm: 1800000, is: false, ip: false },
                     },
                  ],
               }),
            };
         }

         throw new Error(`Unexpected URL: ${url}`);
      };

      const result = await getAggregatedMembers("dummy-token", mockGroups);

      assert.equal(result.totalRawCount, 4);
      assert.equal(result.duplicatesRemoved, 1);
      assert.equal(result.successfulGroups, 2);
      assert.equal(result.members.length, 3);

      // Verify Bob is #1 (7200000 ms), Alice is #2 (5400000 ms), Charlie is #3 (1800000 ms)
      assert.equal(result.members[0].userId, 2);
      assert.equal(result.members[0].nickname, "Bob");
      assert.deepEqual(result.members[0].groupNames, ["Study Group 1"]);

      assert.equal(result.members[1].userId, 1);
      assert.equal(result.members[1].nickname, "Alice");
      assert.equal(result.members[1].liveStudyMs, 5400000);
      assert.equal(result.members[1].isStudying, true);
      assert.equal(result.members[1].currentSubject, "Linear Algebra");
      assert.deepEqual(result.members[1].groupNames, [
         "Study Group 1",
         "Study Group 2",
      ]);

      assert.equal(result.members[2].userId, 3);
      assert.equal(result.members[2].nickname, "Charlie");
      assert.deepEqual(result.members[2].groupNames, ["Study Group 2"]);
   });

   it("resiliently handles one group failing while aggregating others", async () => {
      const mockGroups = [
         { id: 101, name: "Working Group" },
         { id: 999, name: "Failing Group" },
      ];

      globalThis.fetch = async (url) => {
         if (url.includes("groupID=101")) {
            return {
               ok: true,
               headers: { get: () => "application/json" },
               json: async () => ({
                  s: true,
                  ms: [
                     {
                        ud: 10,
                        n: "David",
                        dl: { sm: 1000000 },
                     },
                  ],
               }),
            };
         }

         if (url.includes("groupID=999")) {
            return {
               ok: false,
               status: 500,
               headers: { get: () => "text/plain" },
               text: async () => "Internal Server Error",
            };
         }

         throw new Error(`Unexpected URL: ${url}`);
      };

      const result = await getAggregatedMembers("dummy-token", mockGroups);

      assert.equal(result.successfulGroups, 1);
      assert.equal(result.members.length, 1);
      assert.equal(result.members[0].userId, 10);
      assert.equal(result.members[0].nickname, "David");
   });
});
