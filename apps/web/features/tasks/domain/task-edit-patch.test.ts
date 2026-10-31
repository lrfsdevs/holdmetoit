import { describe, expect, it } from "vitest";
import { buildTaskEditPatch, type TaskEditSnapshot } from "./task-edit-patch";

function snapshot(overrides: Partial<TaskEditSnapshot> = {}): TaskEditSnapshot {
   return {
      title: "Read chapter 4",
      status: "TODO",
      isComplete: false,
      dueDate: "2026-10-30",
      challengeId: null,
      ...overrides,
   };
}

describe("buildTaskEditPatch", () => {
   it("sends only the title when only the title changed", () => {
      expect(
         buildTaskEditPatch(
            snapshot(),
            snapshot({ title: "Read chapter 5" }),
            "DAILY"
         )
      ).toEqual({ title: "Read chapter 5" });
   });

   it("sends status and isComplete together when the status changed", () => {
      expect(
         buildTaskEditPatch(
            snapshot(),
            snapshot({ status: "COMPLETED", isComplete: true }),
            "DAILY"
         )
      ).toEqual({ status: "COMPLETED", isComplete: true });
   });

   it("normalizes an ISO due date to a date key", () => {
      expect(
         buildTaskEditPatch(
            snapshot(),
            snapshot({ dueDate: "2026-11-02T00:00:00.000Z" }),
            "DAILY"
         )
      ).toEqual({ dueDate: "2026-11-02" });
   });

   it("omits an unchanged due date even when the format differs", () => {
      expect(
         buildTaskEditPatch(
            snapshot({ dueDate: "2026-10-30" }),
            snapshot({ dueDate: "2026-10-30T00:00:00.000Z" }),
            "DAILY"
         )
      ).toEqual({});
   });

   it("never sends dueDate or challengeId for a weekly title edit", () => {
      expect(
         buildTaskEditPatch(
            snapshot({ challengeId: "c_1", dueDate: null }),
            snapshot({ title: "Read chapter 5", challengeId: "c_1" }),
            "WEEKLY"
         )
      ).toEqual({ title: "Read chapter 5" });
   });

   it("sends a challengeId when the weekly scope changes", () => {
      expect(
         buildTaskEditPatch(
            snapshot({ challengeId: null }),
            snapshot({ challengeId: "c_1" }),
            "WEEKLY"
         )
      ).toEqual({ challengeId: "c_1" });
   });

   it("sends null when a weekly challenge scope is cleared", () => {
      expect(
         buildTaskEditPatch(
            snapshot({ challengeId: "c_1" }),
            snapshot({ challengeId: null }),
            "WEEKLY"
         )
      ).toEqual({ challengeId: null });
   });

   it("returns an empty patch when nothing changed", () => {
      expect(buildTaskEditPatch(snapshot(), snapshot(), "DAILY")).toEqual({});
   });

   it("ignores a whitespace-only title change", () => {
      expect(
         buildTaskEditPatch(
            snapshot(),
            snapshot({ title: "  Read chapter 4  " }),
            "DAILY"
         )
      ).toEqual({});
   });

   it("does not send status when only the title and due date changed", () => {
      expect(
         buildTaskEditPatch(
            snapshot(),
            snapshot({ title: "New", dueDate: "2026-11-01" }),
            "DAILY"
         )
      ).toEqual({ title: "New", dueDate: "2026-11-01" });
   });
});
