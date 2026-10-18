import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataPagination } from "./data-pagination";

describe("DataPagination", () => {
   it("renders null when totalPages is 1 or less", () => {
      const html1 = renderToStaticMarkup(
         createElement(DataPagination, {
            currentPage: 1,
            totalPages: 1,
            totalItems: 5,
            pageSize: 10,
            onPageChange: vi.fn(),
         })
      );
      expect(html1).toBe("");

      const html0 = renderToStaticMarkup(
         createElement(DataPagination, {
            currentPage: 1,
            totalPages: 0,
            onPageChange: vi.fn(),
         })
      );
      expect(html0).toBe("");
   });

   it("renders pagination controls and summary when totalPages > 1", () => {
      const html = renderToStaticMarkup(
         createElement(DataPagination, {
            currentPage: 2,
            totalPages: 5,
            totalItems: 48,
            pageSize: 10,
            onPageChange: vi.fn(),
            itemLabel: "scholars",
         })
      );

      expect(html).toContain("Showing");
      expect(html).toContain("11–20");
      expect(html).toContain("48");
      expect(html).toContain("scholars");
      expect(html).toContain("Prev");
      expect(html).toContain("Next");
   });

   it("renders compact mode for sidebars and small cards", () => {
      const html = renderToStaticMarkup(
         createElement(DataPagination, {
            currentPage: 1,
            totalPages: 3,
            totalItems: 24,
            pageSize: 8,
            onPageChange: vi.fn(),
            compact: true,
         })
      );

      expect(html).toContain("1–8");
      expect(html).toContain("24");
      expect(html).toContain("1/3");
   });

   it("renders ellipsis when totalPages > 7", () => {
      const html = renderToStaticMarkup(
         createElement(DataPagination, {
            currentPage: 5,
            totalPages: 10,
            totalItems: 100,
            pageSize: 10,
            onPageChange: vi.fn(),
         })
      );

      expect(html).toContain("…");
      expect(html).toContain("Page 5");
   });
});
