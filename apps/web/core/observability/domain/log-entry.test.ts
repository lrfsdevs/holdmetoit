import { describe, expect, it } from "vitest";

import {
   buildLogEntry,
   formatLogEntry,
   serializeError,
} from "@/core/observability/domain/log-entry";
import { logEvents } from "@/core/observability/domain/log-events";

describe("log-entry: serializeError", () => {
   it("serializes an Error with stack and code", () => {
      const error = Object.assign(new Error("boom"), { code: "P2022" });
      const serialized = serializeError(error);

      expect(serialized.name).toBe("Error");
      expect(serialized.message).toBe("boom");
      expect(serialized.code).toBe("P2022");
      expect(serialized.stack).toContain("boom");
   });

   it("normalizes non-Error throwables", () => {
      expect(serializeError("plain string")).toEqual({
         name: "NonError",
         message: "plain string",
      });
      expect(serializeError({ a: 1 })).toEqual({
         name: "NonError",
         message: '{"a":1}',
      });
      expect(serializeError(undefined)).toEqual({
         name: "NonError",
         message: "undefined",
      });
   });
});

describe("log-entry: buildLogEntry", () => {
   it("uses an injected timestamp and omits empty fields", () => {
      const entry = buildLogEntry({
         level: "info",
         event: logEvents.studyLogAdded,
         timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(entry).toEqual({
         ts: "2026-01-01T00:00:00.000Z",
         level: "info",
         event: "study_log.added",
      });
   });

   it("includes scope, context and serialized error when provided", () => {
      const entry = buildLogEntry({
         level: "error",
         event: logEvents.appError,
         scope: "app.boundary",
         context: { challengeId: "c1", count: 2 },
         error: new Error("kaboom"),
         timestamp: new Date("2026-02-02T00:00:00.000Z"),
      });

      expect(entry.ts).toBe("2026-02-02T00:00:00.000Z");
      expect(entry.scope).toBe("app.boundary");
      expect(entry.ctx).toEqual({ challengeId: "c1", count: 2 });
      expect(entry.error?.message).toBe("kaboom");
   });

   it("drops an empty context object", () => {
      const entry = buildLogEntry({
         level: "debug",
         event: logEvents.taskCreated,
         context: {},
         timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(entry.ctx).toBeUndefined();
   });
});

describe("log-entry: formatLogEntry", () => {
   it("emits single-line JSON by default", () => {
      const entry = buildLogEntry({
         level: "info",
         event: logEvents.challengeKickoff,
         timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(formatLogEntry(entry)).toBe(
         '{"ts":"2026-01-01T00:00:00.000Z","level":"info","event":"challenge.kickoff"}'
      );
   });

   it("emits a readable line when pretty", () => {
      const entry = buildLogEntry({
         level: "error",
         event: logEvents.studyLogAdded,
         scope: "study.log",
         context: { challengeId: "c1", ignored: undefined },
         error: new Error("save failed"),
         timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(formatLogEntry(entry, { pretty: true })).toBe(
         "[error] study_log.added (study.log) challengeId=c1 error=Error: save failed"
      );
   });
});
