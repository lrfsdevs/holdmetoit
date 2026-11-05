import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   fenceCodeBlock,
   isInternalPagePath,
   isInternalPageUrl,
   neutralizeMentions,
   toSafeLogRocketUrl,
   toSafePageUrl,
} from "./feedback-links";

describe("isInternalPagePath", () => {
   it.each([
      "/",
      "/dashboard",
      "/challenge/clxyz123",
      "/profile/abc?tab=1#top",
   ])("accepts %s", (path) => {
      expect(isInternalPagePath(path)).toBe(true);
   });

   it.each([
      "",
      "dashboard",
      "https://evil.example/phish",
      "//evil.example/phish",
      "javascript:alert(1)",
      "/\\evil.example",
      "/has space",
      "/[Click here](https://evil.example)",
      "/<script>alert(1)</script>",
      "/@everyone",
      "/line\nbreak",
      // Autolinked by GitHub and Discord when they follow ~, *, _, or (.
      "/~https://evil.example/phish",
      "/*https://evil.example/phish",
      "/_https://evil.example/phish",
      "/x/ftp://evil.example",
      "/~www.evil.example",
      "/(www.evil.example",
      "/?next=https://evil.example",
   ])("rejects %j", (path) => {
      expect(isInternalPagePath(path)).toBe(false);
   });
});

describe("isInternalPageUrl", () => {
   const origin = "https://holdmetoit.com";

   it.each([
      "/dashboard",
      "https://holdmetoit.com/",
      "https://holdmetoit.com/challenge/abc?tab=1#top",
      "https://holdmetoit.com",
      "https://holdmetoit.com?tab=1",
      "https://holdmetoit.com#top",
      "/challenge/www2",
      "/awww.html",
   ])("accepts %s", (value) => {
      expect(isInternalPageUrl(value, origin)).toBe(true);
   });

   // The URL parser drops newlines and tabs, so these would pass a check on
   // the parsed value while the raw text still carries the extra characters.
   it.each([
      [
         "a newline smuggling a second URL",
         "https://holdmetoit.com/x\nhttps://evil.example/phish",
      ],
      [
         "a carriage return",
         "https://holdmetoit.com/x\rhttps://evil.example/phish",
      ],
      ["a tab in the path", "https://holdmetoit.com/x\ty"],
      ["a newline in the origin", "https://holdmetoit.com\n/x"],
      ["a NUL character", "https://holdmetoit.com/x\u0000y"],
      ["a space", "https://holdmetoit.com/x y"],
      ["angle brackets", "https://holdmetoit.com/<script>alert(1)</script>"],
      ["a backtick", "https://holdmetoit.com/x`y"],
      ["a double quote", 'https://holdmetoit.com/x"y'],
      ["a backslash", "https://holdmetoit.com/x\\y"],
      [
         "an embedded link",
         "https://holdmetoit.com/~https://evil.example/phish",
      ],
   ])("rejects an absolute URL containing %s", (_label, value) => {
      expect(isInternalPageUrl(value, origin)).toBe(false);
   });

   it.each([
      "https://evil.example/phish",
      "http://holdmetoit.com/",
      "https://holdmetoit.com.evil.example/",
      "https://holdmetoit.com@evil.example/",
      "https://user:pass@holdmetoit.com/",
      "https://holdmetoit.com/[Click here](https://evil.example)",
      "javascript:alert(1)",
      "//evil.example/phish",
   ])("rejects %s", (value) => {
      expect(isInternalPageUrl(value, origin)).toBe(false);
   });

   it("rejects absolute URLs when the app origin is unknown", () => {
      expect(isInternalPageUrl("https://holdmetoit.com/", null)).toBe(false);
      expect(isInternalPageUrl("/dashboard", null)).toBe(true);
   });
});

describe("toSafePageUrl", () => {
   // Reads AUTH_URL, so pin it for tests that use an absolute URL.
   beforeEach(() => {
      vi.stubEnv("AUTH_URL", "https://holdmetoit.com");
   });

   afterEach(() => {
      vi.unstubAllEnvs();
   });

   it("returns pages on this app unchanged", () => {
      expect(toSafePageUrl("/challenge/abc")).toBe("/challenge/abc");
      expect(toSafePageUrl("https://holdmetoit.com/dashboard")).toBe(
         "https://holdmetoit.com/dashboard"
      );
   });

   it("falls back to the root path for anything else", () => {
      expect(toSafePageUrl("https://evil.example/phish")).toBe("/");
      expect(
         toSafePageUrl("https://holdmetoit.com/x\nhttps://evil.example")
      ).toBe("/");
      expect(toSafePageUrl("")).toBe("/");
   });
});

describe("toSafeLogRocketUrl", () => {
   it("accepts a LogRocket session URL", () => {
      expect(
         toSafeLogRocketUrl("https://app.logrocket.com/org/app/s/1-abc-def/0")
      ).toBe("https://app.logrocket.com/org/app/s/1-abc-def/0");
   });

   it("trims surrounding whitespace", () => {
      expect(toSafeLogRocketUrl("  https://app.logrocket.com/r/demo  ")).toBe(
         "https://app.logrocket.com/r/demo"
      );
   });

   it.each([
      null,
      undefined,
      "",
      "not a url",
      "http://app.logrocket.com/org/app/s/1",
      "https://evil.example/app.logrocket.com",
      "https://app.logrocket.com.evil.example/s/1",
      "https://evil.app.logrocket.com/s/1",
      "https://user:pass@app.logrocket.com/s/1",
      "https://app.logrocket.com:8443/s/1",
      "javascript:alert(1)",
   ])("rejects %j", (value) => {
      expect(toSafeLogRocketUrl(value)).toBeNull();
   });

   it("percent-encodes characters that could break out of a Markdown link", () => {
      const result = toSafeLogRocketUrl(
         "https://app.logrocket.com/a)[click](https://evil.example"
      );

      expect(result).not.toBeNull();
      expect(result).not.toMatch(/[()[\]]/);
      expect(result?.startsWith("https://app.logrocket.com/")).toBe(true);
   });
});

describe("neutralizeMentions", () => {
   it("breaks @mentions, team mentions, and @everyone", () => {
      for (const text of ["@everyone", "@here", "@octocat", "@org/team"]) {
         const result = neutralizeMentions(text);
         expect(result).not.toContain("@" + text.slice(1, 2));
         expect(result.replace(/\u200b/g, "")).toBe(text);
      }
   });

   it("breaks #123 and owner/repo#123 cross-references", () => {
      expect(neutralizeMentions("see #123")).not.toContain("#1");
      expect(neutralizeMentions("owner/repo#45")).not.toContain("#4");
   });

   it("breaks GH-123 references", () => {
      expect(neutralizeMentions("fixes GH-12")).not.toContain("GH-1");
   });

   it("leaves ordinary text untouched", () => {
      expect(neutralizeMentions("Submit button unresponsive")).toBe(
         "Submit button unresponsive"
      );
      expect(neutralizeMentions("# heading without a number")).toBe(
         "# heading without a number"
      );
   });
});

describe("fenceCodeBlock", () => {
   it("wraps text in a triple-backtick fence", () => {
      expect(fenceCodeBlock("hello")).toBe("```\nhello\n```");
   });

   it("uses a fence longer than any backtick run inside the text", () => {
      const fenced = fenceCodeBlock("before\n```\n@everyone\n```\nafter");

      expect(fenced.startsWith("````\n")).toBe(true);
      expect(fenced.endsWith("\n````")).toBe(true);
   });

   it("cannot be closed by a longer run of backticks in the text", () => {
      const fenced = fenceCodeBlock("``````");

      expect(fenced.startsWith("`".repeat(7) + "\n")).toBe(true);
   });
});
