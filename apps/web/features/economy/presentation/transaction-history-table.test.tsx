import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionHistoryTable } from "./transaction-history-table";

describe("TransactionHistoryTable", () => {
   const sampleTransactions = [
      {
         id: "tx_1",
         type: "STUDY_REWARD",
         amount: 100,
         totalDelta: 100,
         reservedDelta: 0,
         sourceType: "DAILY_STUDY_LOG",
         description: "Study reward: +100 coins (3600s)",
         createdAt: new Date("2026-10-15T12:00:00Z"),
      },
      {
         id: "tx_2",
         type: "WAGER_RESERVATION",
         amount: 30,
         totalDelta: 0,
         reservedDelta: 30,
         description: "Wager reservation: 30 coins",
         createdAt: new Date("2026-10-15T12:30:00Z"),
      },
      {
         id: "tx_3",
         type: "ADMIN_ADJUSTMENT",
         amount: -15,
         totalDelta: -15,
         reservedDelta: 0,
         description: "Admin adjustment: Manual correction",
         createdAt: new Date("2026-10-15T13:00:00Z"),
      },
   ];

   it("renders empty state when there are no transactions", () => {
      const html = renderToStaticMarkup(
         createElement(TransactionHistoryTable, {
            transactions: [],
            pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
            onPageChange: vi.fn(),
         })
      );

      expect(html).toContain("No Transactions Yet");
      expect(html).toContain("Log study time during any active challenge");
   });

   it("renders transaction items with correct type badges and amounts", () => {
      const html = renderToStaticMarkup(
         createElement(TransactionHistoryTable, {
            transactions: sampleTransactions,
            pagination: { page: 1, limit: 20, totalCount: 3, totalPages: 1 },
            onPageChange: vi.fn(),
         })
      );

      expect(html).toContain("Append-Only Currency Ledger");
      expect(html).toContain("Study Reward");
      expect(html).toContain("+100 coins");
      expect(html).toContain("Reservation");
      expect(html).toContain("Locked 30 coins");
      expect(html).toContain("Admin Adjustment");
      expect(html).toContain("-15 coins");
   });

   it("renders pagination controls when totalPages > 1", () => {
      const html = renderToStaticMarkup(
         createElement(TransactionHistoryTable, {
            transactions: sampleTransactions,
            pagination: { page: 1, limit: 20, totalCount: 50, totalPages: 3 },
            onPageChange: vi.fn(),
         })
      );

      expect(html).toContain("1 / 3");
      expect(html).toContain("Showing 3 of 50 entries");
   });
});
