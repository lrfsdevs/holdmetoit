import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WalletSummaryCard } from "./wallet-summary-card";

describe("WalletSummaryCard", () => {
   const sampleSummary = {
      totalBalance: 1500,
      reservedBalance: 300,
      availableBalance: 1200,
      rewardProgressSeconds: 18,
      lifetimeEarned: 2000,
      lifetimeSpent: 500,
   };

   it("renders balances accurately with correct formatting", () => {
      const html = renderToStaticMarkup(
         createElement(WalletSummaryCard, {
            summary: sampleSummary,
            isAdmin: false,
         })
      );

      expect(html).toContain("Virtual Coin Wallet");
      expect(html).toContain("1,200"); // Available coins
      expect(html).toContain("300"); // Reserved coins
      expect(html).toContain("2,000"); // Lifetime earned
      expect(html).toContain("500"); // Lifetime spent
      expect(html).toContain("18s / 36s (50%)"); // Fractional progress
   });

   it("renders admin adjust button only when isAdmin is true", () => {
      const htmlAdmin = renderToStaticMarkup(
         createElement(WalletSummaryCard, {
            summary: sampleSummary,
            isAdmin: true,
            onOpenAdminAdjust: vi.fn(),
         })
      );
      expect(htmlAdmin).toContain("Admin Adjust");

      const htmlNonAdmin = renderToStaticMarkup(
         createElement(WalletSummaryCard, {
            summary: sampleSummary,
            isAdmin: false,
         })
      );
      expect(htmlNonAdmin).not.toContain("Admin Adjust");
   });

   it("renders audit & reconcile trigger when onOpenReconcile is provided", () => {
      const html = renderToStaticMarkup(
         createElement(WalletSummaryCard, {
            summary: sampleSummary,
            onOpenReconcile: vi.fn(),
         })
      );
      expect(html).toContain("Audit &amp; Reconcile");
   });
});
