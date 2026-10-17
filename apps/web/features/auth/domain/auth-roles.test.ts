import { describe, expect, it } from "vitest";
import {
   hasAdminPrivileges,
   isDevRole,
   parseDiscordSnowflakeList,
} from "./auth-roles";

describe("auth-roles domain", () => {
   describe("parseDiscordSnowflakeList", () => {
      it("returns empty array for empty, undefined, or null input", () => {
         expect(parseDiscordSnowflakeList(undefined)).toEqual([]);
         expect(parseDiscordSnowflakeList(null)).toEqual([]);
         expect(parseDiscordSnowflakeList("")).toEqual([]);
         expect(parseDiscordSnowflakeList("   ")).toEqual([]);
      });

      it("parses valid JSON array of string snowflakes", () => {
         const raw = '["737561189755912223", "999999999999999999"]';
         expect(parseDiscordSnowflakeList(raw)).toEqual([
            "737561189755912223",
            "999999999999999999",
         ]);
      });

      it("parses JSON array with single snowflake", () => {
         const raw = '["737561189755912223"]';
         expect(parseDiscordSnowflakeList(raw)).toEqual(["737561189755912223"]);
      });

      it("parses JSON array with number literals converting them to strings", () => {
         const raw = "[12345, 67890]";
         expect(parseDiscordSnowflakeList(raw)).toEqual(["12345", "67890"]);
      });

      it("handles whitespace inside and around JSON array", () => {
         const raw = '  [  "111" ,  "222"  ]  ';
         expect(parseDiscordSnowflakeList(raw)).toEqual(["111", "222"]);
      });

      it("parses comma-delimited strings", () => {
         const raw = "737561189755912223, 999999999999999999, 123456";
         expect(parseDiscordSnowflakeList(raw)).toEqual([
            "737561189755912223",
            "999999999999999999",
            "123456",
         ]);
      });

      it("strips wrapping quotes from comma-delimited items", () => {
         const raw = "\"737561189755912223\", '999999999999999999'";
         expect(parseDiscordSnowflakeList(raw)).toEqual([
            "737561189755912223",
            "999999999999999999",
         ]);
      });

      it("falls back to comma separation if JSON array is malformed", () => {
         const raw = "[737561189755912223, 999999";
         expect(parseDiscordSnowflakeList(raw)).toEqual([
            "[737561189755912223",
            "999999",
         ]);
      });
   });

   describe("hasAdminPrivileges", () => {
      it("grants admin privileges to ADMIN role", () => {
         expect(hasAdminPrivileges("ADMIN")).toBe(true);
      });

      it("grants admin privileges to DEV role", () => {
         expect(hasAdminPrivileges("DEV")).toBe(true);
      });

      it("denies admin privileges to PARTICIPANT role", () => {
         expect(hasAdminPrivileges("PARTICIPANT")).toBe(false);
      });

      it("denies admin privileges to undefined, null, or unknown roles", () => {
         expect(hasAdminPrivileges(undefined)).toBe(false);
         expect(hasAdminPrivileges(null)).toBe(false);
         expect(hasAdminPrivileges("GUEST")).toBe(false);
         expect(hasAdminPrivileges("")).toBe(false);
      });
   });

   describe("isDevRole", () => {
      it("returns true only for DEV role", () => {
         expect(isDevRole("DEV")).toBe(true);
         expect(isDevRole("ADMIN")).toBe(false);
         expect(isDevRole("PARTICIPANT")).toBe(false);
         expect(isDevRole(undefined)).toBe(false);
         expect(isDevRole(null)).toBe(false);
      });
   });
});
