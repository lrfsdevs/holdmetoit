import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as ingestService from "@/features/ypt/api/ypt-ingest.service";

vi.mock("@/features/ypt/api/ypt-ingest.service", () => ({
   ingestYptActivity: vi.fn(),
}));

describe("POST /api/v1/ingest/ypt", () => {
   const originalEnv = process.env.YPT_INGEST_API_KEY;

   beforeEach(() => {
      vi.clearAllMocks();
      delete process.env.YPT_INGEST_API_KEY;
   });

   it("rejects request if Bearer token is missing when API key is configured", async () => {
      process.env.YPT_INGEST_API_KEY = "secret_key_123";

      const req = new Request("http://localhost/api/v1/ingest/ypt", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            discordId: "123",
            date: "2026-10-15",
            durationSeconds: 3600,
         }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(401);
   });

   it("rejects request if Bearer token is incorrect", async () => {
      process.env.YPT_INGEST_API_KEY = "secret_key_123";

      const req = new Request("http://localhost/api/v1/ingest/ypt", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer wrong_key",
         },
         body: JSON.stringify({
            discordId: "123",
            date: "2026-10-15",
            durationSeconds: 3600,
         }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(401);
   });

   it("returns 400 on malformed body", async () => {
      const req = new Request("http://localhost/api/v1/ingest/ypt", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: "{ not valid json",
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
   });

   it("returns 400 on validation failure", async () => {
      const req = new Request("http://localhost/api/v1/ingest/ypt", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            durationSeconds: -50,
         }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
   });

   it("returns 200 and result on successful ingestion", async () => {
      vi.mocked(ingestService.ingestYptActivity).mockResolvedValue({
         ok: true,
         userId: "usr_1",
         participantId: "part_1",
         studyLogId: "log_1",
         durationSeconds: 3600,
         coinsCredited: 100,
         isDuplicate: false,
      });

      const req = new Request("http://localhost/api/v1/ingest/ypt", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            discordId: "disc_user_1",
            date: "2026-10-15",
            durationSeconds: 3600,
         }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.coinsCredited).toBe(100);
   });
});
