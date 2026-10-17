import { SECONDS_PER_COIN, TransactionTypeValue } from "./economy-constants";

export interface WalletState {
   totalBalance: number;
   reservedBalance: number;
   rewardProgressSeconds: number;
   lifetimeEarned: number;
   lifetimeSpent: number;
}

export interface WalletSummary extends WalletState {
   availableBalance: number;
}

export class InsufficientFundsError extends Error {
   readonly code = "INSUFFICIENT_FUNDS";
   constructor(
      message = "Insufficient available funds to complete the transaction."
   ) {
      super(message);
      this.name = "InsufficientFundsError";
   }
}

export class InvalidReservationError extends Error {
   readonly code = "INVALID_RESERVATION";
   constructor(
      message = "Requested release or settlement exceeds currently reserved funds."
   ) {
      super(message);
      this.name = "InvalidReservationError";
   }
}

export class WalletInvariantViolationError extends Error {
   readonly code = "WALLET_INVARIANT_VIOLATION";
   constructor(
      message = "Wallet state violates fundamental accounting invariants."
   ) {
      super(message);
      this.name = "WalletInvariantViolationError";
   }
}

export class InvalidAmountError extends Error {
   readonly code = "INVALID_AMOUNT";
   constructor(
      message = "Transaction amount must be a positive safe integer."
   ) {
      super(message);
      this.name = "InvalidAmountError";
   }
}

/** Calculates derived available balance: totalBalance - reservedBalance */
export function calculateAvailableBalance(
   totalBalance: number,
   reservedBalance: number
): number {
   return totalBalance - reservedBalance;
}

/** Validates that a wallet state satisfies all fundamental economic invariants */
export function validateWalletInvariants(state: WalletState): void {
   if (!Number.isSafeInteger(state.totalBalance) || state.totalBalance < 0) {
      throw new WalletInvariantViolationError(
         `Total balance must be non-negative (received: ${state.totalBalance}).`
      );
   }
   if (
      !Number.isSafeInteger(state.reservedBalance) ||
      state.reservedBalance < 0
   ) {
      throw new WalletInvariantViolationError(
         `Reserved balance must be non-negative (received: ${state.reservedBalance}).`
      );
   }
   if (state.totalBalance < state.reservedBalance) {
      throw new WalletInvariantViolationError(
         `Total balance (${state.totalBalance}) cannot be less than reserved balance (${state.reservedBalance}).`
      );
   }
   if (
      !Number.isSafeInteger(state.rewardProgressSeconds) ||
      state.rewardProgressSeconds < 0 ||
      state.rewardProgressSeconds >= SECONDS_PER_COIN
   ) {
      throw new WalletInvariantViolationError(
         `Reward progress seconds must be in range [0, ${SECONDS_PER_COIN - 1}] (received: ${state.rewardProgressSeconds}).`
      );
   }
   if (
      !Number.isSafeInteger(state.lifetimeEarned) ||
      state.lifetimeEarned < 0
   ) {
      throw new WalletInvariantViolationError(
         `Lifetime earned must be non-negative (received: ${state.lifetimeEarned}).`
      );
   }
   if (!Number.isSafeInteger(state.lifetimeSpent) || state.lifetimeSpent < 0) {
      throw new WalletInvariantViolationError(
         `Lifetime spent must be non-negative (received: ${state.lifetimeSpent}).`
      );
   }
}

export function toWalletSummary(state: WalletState): WalletSummary {
   validateWalletInvariants(state);
   return {
      ...state,
      availableBalance: calculateAvailableBalance(
         state.totalBalance,
         state.reservedBalance
      ),
   };
}

export interface AccountingEffect {
   nextState: WalletState;
   totalDelta: number;
   reservedDelta: number;
}

/**
 * Credits whole coins to a wallet.
 * Increases totalBalance, lifetimeEarned, and derived availableBalance.
 */
export function applyCredit(
   state: WalletState,
   amount: number
): AccountingEffect {
   validateWalletInvariants(state);
   if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new InvalidAmountError(
         `Credit amount must be a non-negative integer (received: ${amount}).`
      );
   }

   const nextState: WalletState = {
      ...state,
      totalBalance: state.totalBalance + amount,
      lifetimeEarned: state.lifetimeEarned + amount,
   };

   validateWalletInvariants(nextState);
   return { nextState, totalDelta: amount, reservedDelta: 0 };
}

/**
 * Debits whole coins from a wallet.
 * Requires availableBalance >= amount.
 * Decreases totalBalance and derived availableBalance; increases lifetimeSpent.
 */
export function applyDebit(
   state: WalletState,
   amount: number
): AccountingEffect {
   validateWalletInvariants(state);
   if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new InvalidAmountError(
         `Debit amount must be a positive integer (received: ${amount}).`
      );
   }

   const available = calculateAvailableBalance(
      state.totalBalance,
      state.reservedBalance
   );
   if (available < amount) {
      throw new InsufficientFundsError(
         `Insufficient available balance (${available} coins) for debit of ${amount} coins.`
      );
   }

   const nextState: WalletState = {
      ...state,
      totalBalance: state.totalBalance - amount,
      lifetimeSpent: state.lifetimeSpent + amount,
   };

   validateWalletInvariants(nextState);
   return { nextState, totalDelta: -amount, reservedDelta: 0 };
}

/**
 * Reserves whole coins for pending future operations (e.g. wagers, trades).
 * Requires availableBalance >= amount.
 * totalBalance does NOT change; reservedBalance increases; availableBalance decreases.
 */
export function applyReservation(
   state: WalletState,
   amount: number
): AccountingEffect {
   validateWalletInvariants(state);
   if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new InvalidAmountError(
         `Reservation amount must be a positive integer (received: ${amount}).`
      );
   }

   const available = calculateAvailableBalance(
      state.totalBalance,
      state.reservedBalance
   );
   if (available < amount) {
      throw new InsufficientFundsError(
         `Insufficient available balance (${available} coins) to reserve ${amount} coins.`
      );
   }

   const nextState: WalletState = {
      ...state,
      reservedBalance: state.reservedBalance + amount,
   };

   validateWalletInvariants(nextState);
   return { nextState, totalDelta: 0, reservedDelta: amount };
}

/**
 * Releases previously reserved funds back to available balance.
 * Requires reservedBalance >= amount.
 * totalBalance does NOT change; reservedBalance decreases; availableBalance increases.
 */
export function applyRelease(
   state: WalletState,
   amount: number
): AccountingEffect {
   validateWalletInvariants(state);
   if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new InvalidAmountError(
         `Release amount must be a positive integer (received: ${amount}).`
      );
   }

   if (state.reservedBalance < amount) {
      throw new InvalidReservationError(
         `Cannot release ${amount} coins; only ${state.reservedBalance} coins are reserved.`
      );
   }

   const nextState: WalletState = {
      ...state,
      reservedBalance: state.reservedBalance - amount,
   };

   validateWalletInvariants(nextState);
   return { nextState, totalDelta: 0, reservedDelta: -amount };
}

/**
 * Settles/consumes previously reserved funds upon completion of an operation.
 * Requires reservedBalance >= amount and totalBalance >= amount.
 * Decreases both totalBalance and reservedBalance; increases lifetimeSpent.
 */
export function applySettlement(
   state: WalletState,
   amount: number
): AccountingEffect {
   validateWalletInvariants(state);
   if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new InvalidAmountError(
         `Settlement amount must be a positive integer (received: ${amount}).`
      );
   }

   if (state.reservedBalance < amount) {
      throw new InvalidReservationError(
         `Cannot settle ${amount} coins; only ${state.reservedBalance} coins are reserved.`
      );
   }

   const nextState: WalletState = {
      ...state,
      totalBalance: state.totalBalance - amount,
      reservedBalance: state.reservedBalance - amount,
      lifetimeSpent: state.lifetimeSpent + amount,
   };

   validateWalletInvariants(nextState);
   return { nextState, totalDelta: -amount, reservedDelta: -amount };
}

/**
 * Calculates compensating deltas to reverse a previous transaction.
 */
export function applyReversal(
   state: WalletState,
   original: { totalDelta: number; reservedDelta: number }
): AccountingEffect {
   validateWalletInvariants(state);

   // To reverse: negate the original deltas
   const reverseTotalDelta = -original.totalDelta;
   const reverseReservedDelta = -original.reservedDelta;

   const nextTotal = state.totalBalance + reverseTotalDelta;
   const nextReserved = state.reservedBalance + reverseReservedDelta;

   if (nextTotal < 0) {
      throw new InsufficientFundsError(
         "Reversing this credit would cause total balance to become negative."
      );
   }
   if (nextReserved < 0) {
      throw new InvalidReservationError(
         "Reversing this reservation would cause reserved balance to become negative."
      );
   }
   if (nextTotal < nextReserved) {
      throw new WalletInvariantViolationError(
         "Reversal would result in reserved balance exceeding total balance."
      );
   }

   const nextState: WalletState = {
      ...state,
      totalBalance: nextTotal,
      reservedBalance: nextReserved,
      lifetimeEarned:
         reverseTotalDelta < 0
            ? Math.max(0, state.lifetimeEarned + reverseTotalDelta)
            : state.lifetimeEarned,
      lifetimeSpent:
         reverseTotalDelta > 0
            ? Math.max(0, state.lifetimeSpent - reverseTotalDelta)
            : state.lifetimeSpent,
   };

   validateWalletInvariants(nextState);
   return {
      nextState,
      totalDelta: reverseTotalDelta,
      reservedDelta: reverseReservedDelta,
   };
}
