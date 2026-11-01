// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskSyncIssueBanner } from "./task-sync-issue-banner";
import * as taskIdb from "@/features/tasks/data/local/task-idb";
import * as taskSyncService from "@/features/tasks/data/local/task-sync.service";

vi.mock("@/features/tasks/data/local/task-idb", () => ({
   getDeadLetterMutations: vi.fn(),
   retryDeadLetterMutation: vi.fn(),
   discardDeadLetterMutation: vi.fn(),
}));

vi.mock("@/features/tasks/data/local/task-sync.service", () => ({
   scheduleSync: vi.fn(),
   TASKS_DEAD_LETTER_EVENT: "holdmetoit:task-sync-dead-letter",
}));

describe("TaskSyncIssueBanner", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(taskIdb.getDeadLetterMutations).mockResolvedValue([]);
      vi.mocked(taskIdb.retryDeadLetterMutation).mockResolvedValue();
      vi.mocked(taskIdb.discardDeadLetterMutation).mockResolvedValue();
   });

   it("renders nothing when there are no dead-letter mutations", async () => {
      const { container } = render(<TaskSyncIssueBanner userId="user_1" />);

      await waitFor(() => {
         expect(taskIdb.getDeadLetterMutations).toHaveBeenCalledWith("user_1");
      });
      expect(container.firstChild).toBeNull();
   });

   it("retries and discards dead-letter mutations", async () => {
      vi.mocked(taskIdb.getDeadLetterMutations).mockResolvedValue([
         {
            id: "mut_1",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_1", title: "Edited" },
            createdAt: 1,
            retryCount: 5,
            userId: "user_1",
            failedAt: 2,
            lastError: "server_error",
         },
      ]);

      render(<TaskSyncIssueBanner userId="user_1" />);

      expect(await screen.findByText(/1 change couldn't sync/i)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => {
         expect(taskIdb.retryDeadLetterMutation).toHaveBeenCalledWith("mut_1");
         expect(taskSyncService.scheduleSync).toHaveBeenCalledWith("user_1", 0);
      });

      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() => {
         expect(taskIdb.discardDeadLetterMutation).toHaveBeenCalledWith(
            "mut_1"
         );
      });
   });
});
