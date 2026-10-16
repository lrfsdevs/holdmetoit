import { describe, expect, it } from "vitest";
import {
   applyCredit,
   applyDebit,
   applyRelease,
   applyReservation,
   applyReversal,
   applySettlement,
   calculateAvailableBalance,
   InsufficientFundsError,
   InvalidAmountError,
   InvalidReservationError,
   toWalletSummary,
   validateWalletInvariants,
   WalletInvariantViolationError,
   type WalletState,
} from "./wallet-accounting";

describe("wallet-accounting domain rules", () => {
   const createInitialState = (): WalletState => ({
      totalBalance: 0,
      reservedBalance: 0,
      rewardProgressSeconds: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
   });

   it("1. creates initial wallet state with zero balances and valid invariants", () => {
      const state = createInitialState();
      expect(() => validateWalletInvariants(state)).not.toThrow();

      const summary = toWalletSummary(state);
      expect(summary.availableBalance).toBe(0);
      expect(summary.totalBalance).toBe(0);
      expect(summary.reservedBalance).toBe(0);
   });

   it("2. credit operation increases totalBalance, lifetimeEarned, and availableBalance", () => {
      const initial = createInitialState();
      const { nextState, totalDelta, reservedDelta } = applyCredit(
         initial,
         100
      );

      expect(totalDelta).toBe(100);
      expect(reservedDelta).toBe(0);
      expect(nextState.totalBalance).toBe(100);
      expect(nextState.lifetimeEarned).toBe(100);
      expect(nextState.reservedBalance).toBe(0);
      expect(
         calculateAvailableBalance(
            nextState.totalBalance,
            nextState.reservedBalance
         )
      ).toBe(100);
   });

   it("3. debit operation decreases totalBalance and increases lifetimeSpent", () => {
      const fundedState: WalletState = {
         totalBalance: 100,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, totalDelta, reservedDelta } = applyDebit(
         fundedState,
         40
      );
      expect(totalDelta).toBe(-40);
      expect(reservedDelta).toBe(0);
      expect(nextState.totalBalance).toBe(60);
      expect(nextState.lifetimeSpent).toBe(40);
      expect(
         calculateAvailableBalance(
            nextState.totalBalance,
            nextState.reservedBalance
         )
      ).toBe(60);
   });

   it("4. debit rejects when available balance is insufficient", () => {
      const fundedState: WalletState = {
         totalBalance: 50,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 50,
         lifetimeSpent: 0,
      };

      expect(() => applyDebit(fundedState, 80)).toThrow(InsufficientFundsError);
   });

   it("5. reservation reduces available balance while totalBalance remains unchanged", () => {
      const fundedState: WalletState = {
         totalBalance: 100,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, totalDelta, reservedDelta } = applyReservation(
         fundedState,
         35
      );
      expect(totalDelta).toBe(0);
      expect(reservedDelta).toBe(35);
      expect(nextState.totalBalance).toBe(100);
      expect(nextState.reservedBalance).toBe(35);
      expect(
         calculateAvailableBalance(
            nextState.totalBalance,
            nextState.reservedBalance
         )
      ).toBe(65);
   });

   it("6. reservation fails if requested amount exceeds available balance", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 60, // available = 40
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      expect(() => applyReservation(state, 50)).toThrow(InsufficientFundsError);
   });

   it("7. release restores reserved funds to available balance without changing totalBalance", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 40,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, totalDelta, reservedDelta } = applyRelease(state, 40);
      expect(totalDelta).toBe(0);
      expect(reservedDelta).toBe(-40);
      expect(nextState.totalBalance).toBe(100);
      expect(nextState.reservedBalance).toBe(0);
      expect(
         calculateAvailableBalance(
            nextState.totalBalance,
            nextState.reservedBalance
         )
      ).toBe(100);
   });

   it("8. release rejects if amount exceeds current reserved balance", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 20,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      expect(() => applyRelease(state, 25)).toThrow(InvalidReservationError);
   });

   it("9. settlement consumes reserved funds, reducing total and reserved balances", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 50,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, totalDelta, reservedDelta } = applySettlement(
         state,
         50
      );
      expect(totalDelta).toBe(-50);
      expect(reservedDelta).toBe(-50);
      expect(nextState.totalBalance).toBe(50);
      expect(nextState.reservedBalance).toBe(0);
      expect(nextState.lifetimeSpent).toBe(50);
      expect(
         calculateAvailableBalance(
            nextState.totalBalance,
            nextState.reservedBalance
         )
      ).toBe(50);
   });

   it("10. reversal inverts the accounting effect of a credit", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, totalDelta } = applyReversal(state, {
         totalDelta: 100,
         reservedDelta: 0,
      });

      expect(totalDelta).toBe(-100);
      expect(nextState.totalBalance).toBe(0);
   });

   it("11. reversal inverts the accounting effect of a reservation", () => {
      const state: WalletState = {
         totalBalance: 100,
         reservedBalance: 40,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const { nextState, reservedDelta } = applyReversal(state, {
         totalDelta: 0,
         reservedDelta: 40,
      });

      expect(reservedDelta).toBe(-40);
      expect(nextState.reservedBalance).toBe(0);
      expect(nextState.totalBalance).toBe(100);
   });

   it("12. rejects invalid amounts (negative, float, zero where positive required)", () => {
      const state = createInitialState();
      expect(() => applyCredit(state, -5)).toThrow(InvalidAmountError);
      expect(() => applyDebit(state, 0)).toThrow(InvalidAmountError);
      expect(() => applyDebit(state, -10)).toThrow(InvalidAmountError);
      expect(() => applyReservation(state, 12.5)).toThrow(InvalidAmountError);
   });

   it("13. throws WalletInvariantViolationError if invariants are violated", () => {
      expect(() =>
         validateWalletInvariants({
            totalBalance: 50,
            reservedBalance: 60, // reserved > total!
            rewardProgressSeconds: 0,
            lifetimeEarned: 50,
            lifetimeSpent: 0,
         })
      ).toThrow(WalletInvariantViolationError);

      expect(() =>
         validateWalletInvariants({
            totalBalance: -10, // negative total!
            reservedBalance: 0,
            rewardProgressSeconds: 0,
            lifetimeEarned: 0,
            lifetimeSpent: 0,
         })
      ).toThrow(WalletInvariantViolationError);

      expect(() =>
         validateWalletInvariants({
            totalBalance: 100,
            reservedBalance: 0,
            rewardProgressSeconds: 36, // progress >= 36!
            lifetimeEarned: 100,
            lifetimeSpent: 0,
         })
      ).toThrow(WalletInvariantViolationError);
   });

   it("14. full multi-step economy lifecycle simulation", () => {
      let state = createInitialState();

      // Step 1: User earns 100 coins
      state = applyCredit(state, 100).nextState;
      expect(state.totalBalance).toBe(100);
      expect(
         calculateAvailableBalance(state.totalBalance, state.reservedBalance)
      ).toBe(100);

      // Step 2: User reserves 40 coins for a wager
      state = applyReservation(state, 40).nextState;
      expect(state.totalBalance).toBe(100);
      expect(state.reservedBalance).toBe(40);
      expect(
         calculateAvailableBalance(state.totalBalance, state.reservedBalance)
      ).toBe(60);

      // Step 3: User spends 30 available coins on a purchase
      state = applyDebit(state, 30).nextState;
      expect(state.totalBalance).toBe(70);
      expect(state.reservedBalance).toBe(40);
      expect(
         calculateAvailableBalance(state.totalBalance, state.reservedBalance)
      ).toBe(30);

      // Step 4: 20 coins of the wager are refunded (released)
      state = applyRelease(state, 20).nextState;
      expect(state.totalBalance).toBe(70);
      expect(state.reservedBalance).toBe(20);
      expect(
         calculateAvailableBalance(state.totalBalance, state.reservedBalance)
      ).toBe(50);

      // Step 5: Remaining 20 coins of the wager are settled (lost)
      state = applySettlement(state, 20).nextState;
      expect(state.totalBalance).toBe(50);
      expect(state.reservedBalance).toBe(0);
      expect(
         calculateAvailableBalance(state.totalBalance, state.reservedBalance)
      ).toBe(50);
      expect(state.lifetimeSpent).toBe(50); // 30 purchase + 20 wager loss
      expect(state.lifetimeEarned).toBe(100);
   });
});
