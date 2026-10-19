import { describe, expect, it } from "vitest";
import {
   DEFAULT_CHALLENGE_DESCRIPTION,
   parseChallengeDescription,
   resolveChallengeDescription,
} from "./challenge-description";

describe("parseChallengeDescription", () => {
   it("parses level 1 and level 2 headings", () => {
      const blocks = parseChallengeDescription("# One\n## Two");

      expect(blocks[0]).toEqual({
         type: "heading",
         level: 1,
         content: [{ type: "text", value: "One" }],
      });
      expect(blocks[1]).toEqual({
         type: "heading",
         level: 2,
         content: [{ type: "text", value: "Two" }],
      });
   });

   it("does not treat ### or heading-like text as headings", () => {
      expect(parseChallengeDescription("### Three")[0]).toEqual({
         type: "paragraph",
         lines: [[{ type: "text", value: "### Three" }]],
      });
      expect(parseChallengeDescription("#NoSpace")[0]?.type).toBe("paragraph");
   });

   it("parses --- as a divider", () => {
      expect(parseChallengeDescription("---")).toEqual([{ type: "divider" }]);
   });

   it("keeps ---- and --- text as paragraphs", () => {
      expect(parseChallengeDescription("----")[0]?.type).toBe("paragraph");
      expect(parseChallengeDescription("--- text")[0]?.type).toBe("paragraph");
   });

   it("splits paragraphs on blank lines and keeps single newlines", () => {
      const blocks = parseChallengeDescription(
         "line one\nline two\n\nnext paragraph"
      );

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
         type: "paragraph",
         lines: [
            [{ type: "text", value: "line one" }],
            [{ type: "text", value: "line two" }],
         ],
      });
      expect(blocks[1]).toEqual({
         type: "paragraph",
         lines: [[{ type: "text", value: "next paragraph" }]],
      });
   });

   it("parses external and relative links", () => {
      expect(
         parseChallengeDescription("[YPT](https://link.yeolpumta.com)")[0]
      ).toEqual({
         type: "paragraph",
         lines: [
            [
               {
                  type: "link",
                  label: "YPT",
                  href: "https://link.yeolpumta.com",
               },
            ],
         ],
      });

      expect(parseChallengeDescription("[Profile](/profile)")[0]).toEqual({
         type: "paragraph",
         lines: [[{ type: "link", label: "Profile", href: "/profile" }]],
      });
   });

   it("parses links mixed with text", () => {
      const blocks = parseChallengeDescription(
         "Visit [YPT](https://link.yeolpumta.com) now"
      );

      expect(blocks[0]).toEqual({
         type: "paragraph",
         lines: [
            [
               { type: "text", value: "Visit " },
               {
                  type: "link",
                  label: "YPT",
                  href: "https://link.yeolpumta.com",
               },
               { type: "text", value: " now" },
            ],
         ],
      });
   });

   it("keeps unsafe links and raw HTML as literal text", () => {
      const unsafe = parseChallengeDescription("[x](javascript:alert(1))");
      expect(unsafe[0]).toEqual({
         type: "paragraph",
         lines: [
            [
               {
                  type: "text",
                  value: "[x](javascript:alert(1))",
               },
            ],
         ],
      });

      const html = parseChallengeDescription("<script>alert(1)</script>");
      expect(html[0]).toEqual({
         type: "paragraph",
         lines: [
            [
               {
                  type: "text",
                  value: "<script>alert(1)</script>",
               },
            ],
         ],
      });
   });
});

describe("resolveChallengeDescription", () => {
   it("falls back to the default for null, undefined, and blank values", () => {
      expect(resolveChallengeDescription(null)).toBe(
         DEFAULT_CHALLENGE_DESCRIPTION
      );
      expect(resolveChallengeDescription(undefined)).toBe(
         DEFAULT_CHALLENGE_DESCRIPTION
      );
      expect(resolveChallengeDescription("   \n  ")).toBe(
         DEFAULT_CHALLENGE_DESCRIPTION
      );
   });

   it("returns custom descriptions trimmed", () => {
      expect(resolveChallengeDescription("  # Custom  ")).toBe("# Custom");
   });

   it("uses only supported syntax in the default template", () => {
      expect(DEFAULT_CHALLENGE_DESCRIPTION).toContain("# How it works");
      expect(DEFAULT_CHALLENGE_DESCRIPTION).toContain("# Prizes & Rewards");
      expect(DEFAULT_CHALLENGE_DESCRIPTION).toContain("\n---\n");
      expect(DEFAULT_CHALLENGE_DESCRIPTION).toContain(
         "[Yeolpumta (YPT) group](https://link.yeolpumta.com)"
      );
   });
});
