import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeDescriptionContent } from "./challenge-description-content";

function render(source?: string | null): string {
   return renderToStaticMarkup(
      createElement(ChallengeDescriptionContent, { source })
   );
}

describe("ChallengeDescriptionContent", () => {
   it("renders # and ## headings", () => {
      const html = render("# How it works\n\n## Details");

      expect(html).toContain("<h2");
      expect(html).toContain("How it works</h2>");
      expect(html).toContain("<h3");
      expect(html).toContain("Details</h3>");
   });

   it("renders --- as a divider", () => {
      const html = render("Before\n\n---\n\nAfter");

      expect(html).toContain("<hr");
      expect(html).toContain("Before");
      expect(html).toContain("After");
   });

   it("preserves single newlines as line breaks", () => {
      const html = render("Line one\nLine two");

      expect(html).toContain("Line one<br/>Line two");
   });

   it("renders external links safely", () => {
      const html = render("[YPT](https://link.yeolpumta.com)");

      expect(html).toContain('href="https://link.yeolpumta.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noreferrer noopener"');
      expect(html).toContain("YPT");
   });

   it("keeps relative links in the same tab", () => {
      const html = render("[Profile](/profile)");

      expect(html).toContain('href="/profile"');
      expect(html).not.toContain('target="_blank"');
   });

   it("escapes raw HTML", () => {
      const html = render("<script>alert(1)</script>");

      expect(html).not.toContain("<script");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
   });

   it("never emits an unsafe javascript href", () => {
      const html = render("[Click](javascript:alert(1))");

      expect(html).not.toContain('href="javascript:');
      expect(html).toContain("[Click](javascript:alert(1))");
   });

   it("renders the default body when the source is empty", () => {
      const html = render("");

      expect(html).toContain("An automated study battle governed by");
      expect(html).toContain("How it works");
      expect(html).toContain("Prizes &amp; Rewards");
      expect(html).toContain('href="https://link.yeolpumta.com"');
   });
});
