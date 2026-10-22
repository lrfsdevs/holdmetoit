// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
} from "@testing-library/react";

import { WithdrawChallengeButton } from "./withdraw-challenge-modal";
import { withdrawFromChallengeAction } from "@/features/challenges/api/withdraw-participant.actions";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
   useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/features/challenges/api/withdraw-participant.actions", () => ({
   withdrawFromChallengeAction: vi.fn(),
}));

afterEach(cleanup);

describe("WithdrawChallengeButton", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(withdrawFromChallengeAction).mockResolvedValue({ ok: true });
   });

   it("opens the confirmation dialog and submits the withdrawal", async () => {
      render(
         <WithdrawChallengeButton
            challengeId="chal-1"
            challengeTitle="Study Battle"
         />
      );

      fireEvent.click(screen.getByTestId("withdraw-challenge-button"));

      expect(
         await screen.findByText("Withdraw from Study Battle?")
      ).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /yes, withdraw/i }));

      await waitFor(() =>
         expect(withdrawFromChallengeAction).toHaveBeenCalledWith({
            challengeId: "chal-1",
         })
      );
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
   });

   it("does not call the action when cancelled", async () => {
      render(
         <WithdrawChallengeButton
            challengeId="chal-1"
            challengeTitle="Study Battle"
         />
      );

      fireEvent.click(screen.getByTestId("withdraw-challenge-button"));
      await screen.findByText("Withdraw from Study Battle?");

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(withdrawFromChallengeAction).not.toHaveBeenCalled();
   });

   it("shows the server error and keeps the dialog open", async () => {
      vi.mocked(withdrawFromChallengeAction).mockResolvedValue({
         ok: false,
         code: "RESULTS_LOCKED",
         message: "Results are locked; withdrawal is no longer possible.",
      });

      render(
         <WithdrawChallengeButton
            challengeId="chal-1"
            challengeTitle="Study Battle"
         />
      );

      fireEvent.click(screen.getByTestId("withdraw-challenge-button"));
      fireEvent.click(
         await screen.findByRole("button", { name: /yes, withdraw/i })
      );

      expect(
         await screen.findByText(
            "Results are locked; withdrawal is no longer possible."
         )
      ).toBeTruthy();
      expect(refreshMock).not.toHaveBeenCalled();
   });
});
