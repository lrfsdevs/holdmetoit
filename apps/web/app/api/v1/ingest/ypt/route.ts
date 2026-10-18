import { NextRequest, NextResponse } from "next/server";
import { yptIngestSchema } from "@/features/ypt/domain/ypt.types";
import { ingestYptActivity } from "@/features/ypt/api/ypt-ingest.service";

export async function POST(req: NextRequest) {
   // 1. Bearer Token Authentication
   const authHeader = req.headers.get("authorization");
   const expectedApiKey = process.env.YPT_INGEST_API_KEY;

   if (expectedApiKey) {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return NextResponse.json(
            { error: "Unauthorized: Missing or malformed Bearer token." },
            { status: 401 }
         );
      }
      const token = authHeader.slice(7).trim();
      if (token !== expectedApiKey) {
         return NextResponse.json(
            { error: "Unauthorized: Invalid API key." },
            { status: 401 }
         );
      }
   }

   // 2. Parse & Validate Payload
   let body: unknown;
   try {
      body = await req.json();
   } catch {
      return NextResponse.json(
         { error: "Bad Request: Invalid JSON body." },
         { status: 400 }
      );
   }

   const parseResult = yptIngestSchema.safeParse(body);
   if (!parseResult.success) {
      return NextResponse.json(
         {
            error: "Validation failed",
            issues: parseResult.error.flatten(),
         },
         { status: 400 }
      );
   }

   // 3. Process Activity Ingestion
   const result = await ingestYptActivity(parseResult.data, "YPT_BOT");

   if (!result.ok) {
      const statusCode =
         result.code === "USER_NOT_FOUND"
            ? 404
            : result.code === "NOT_ENROLLED_IN_ACTIVE_CHALLENGE"
              ? 422
              : 400;

      return NextResponse.json(result, { status: statusCode });
   }

   return NextResponse.json(result, { status: 200 });
}
