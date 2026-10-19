import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
   it("uses the first forwarded address", () => {
      const headers = new Headers({
         "x-forwarded-for": "203.0.113.5, 10.0.0.1",
         "x-real-ip": "198.51.100.9",
      });
      expect(getClientIp(headers)).toBe("203.0.113.5");
   });

   it("falls back to x-real-ip and then anonymous", () => {
      expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe(
         "198.51.100.9"
      );
      expect(getClientIp(new Headers())).toBe("anonymous");
   });
});
