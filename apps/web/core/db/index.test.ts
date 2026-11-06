import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   createPrismaClient,
   isLocalDatabaseHost,
   resolveSslConfig,
} from "./index";

describe("core/db connection & TLS configuration", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   afterEach(() => {
      vi.unstubAllEnvs();
   });

   describe("isLocalDatabaseHost", () => {
      it("identifies localhost variations as local database hosts", () => {
         expect(
            isLocalDatabaseHost("postgresql://localhost:5432/holdmetoit")
         ).toBe(true);
         expect(
            isLocalDatabaseHost("postgresql://127.0.0.1:5432/holdmetoit")
         ).toBe(true);
         expect(isLocalDatabaseHost("postgresql://[::1]:5432/holdmetoit")).toBe(
            true
         );
         expect(
            isLocalDatabaseHost("postgresql://db.local:5432/holdmetoit")
         ).toBe(true);
      });

      it("identifies remote hosts as non-local", () => {
         expect(
            isLocalDatabaseHost(
               "postgresql://postgres.xxx:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
            )
         ).toBe(false);
         expect(
            isLocalDatabaseHost(
               "postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb"
            )
         ).toBe(false);
      });

      it("returns false for invalid URL strings", () => {
         expect(isLocalDatabaseHost("not-a-valid-url")).toBe(false);
      });
   });

   describe("resolveSslConfig", () => {
      it("preserves local localhost without SSL", () => {
         const ssl = resolveSslConfig("postgresql://localhost:5432/holdmetoit");
         expect(ssl).toBeUndefined();
      });

      it("respects explicitly passed custom SSL options regardless of host", () => {
         const customSsl = { rejectUnauthorized: false };
         expect(
            resolveSslConfig(
               "postgresql://localhost:5432/holdmetoit",
               customSsl
            )
         ).toBe(customSsl);
      });

      it("enforces full TLS validation when DATABASE_SSL_CA is configured", () => {
         const dummyCa =
            "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----";
         vi.stubEnv("DATABASE_SSL_CA", dummyCa);

         const ssl = resolveSslConfig(
            "postgresql://postgres.xxx:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
         );
         expect(ssl).toEqual({
            rejectUnauthorized: true,
            ca: dummyCa,
         });
      });

      it("enforces rejectUnauthorized when DATABASE_SSL_REJECT_UNAUTHORIZED is true", () => {
         vi.stubEnv("DATABASE_SSL_REJECT_UNAUTHORIZED", "true");

         const ssl = resolveSslConfig(
            "postgresql://postgres.xxx:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
         );
         expect(ssl).toEqual({
            rejectUnauthorized: true,
         });
      });

      it("returns undefined for remote hosts when no CA or strict flag is set to preserve driver defaults", () => {
         const ssl = resolveSslConfig(
            "postgresql://postgres.xxx:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
         );
         expect(ssl).toBeUndefined();
      });
   });

   describe("createPrismaClient", () => {
      it("instantiates PrismaClient with local fallback URL", () => {
         const client = createPrismaClient(
            "postgresql://localhost:5432/holdmetoit"
         );
         expect(client).toBeDefined();
         expect(typeof client.$connect).toBe("function");
      });

      it("instantiates PrismaClient with custom SSL options", () => {
         const client = createPrismaClient(
            "postgresql://postgres.xxx:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
            { ssl: { rejectUnauthorized: false } }
         );
         expect(client).toBeDefined();
         expect(typeof client.$connect).toBe("function");
      });
   });
});
