"use server";

import { requireSessionUser } from "@/features/auth/api/require-session";
import { revalidatePath } from "next/cache";
import {
   LinkYptInput,
   linkYptSchema,
   YptManualImportPayload,
   yptManualImportSchema,
} from "../domain/ypt.types";
import { linkUserYptId } from "../data/ypt.repository";
import { ingestYptActivity } from "./ypt-ingest.service";

export async function linkYptAccountAction(input: LinkYptInput) {
   try {
      const user = await requireSessionUser();
      const parsed = linkYptSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message ||
            (parsed.error as any).errors?.[0]?.message ||
            "Invalid YPT ID format.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      await linkUserYptId(user.id, parsed.data.yptId);

      revalidatePath("/wallet");
      revalidatePath("/profile");

      return {
         ok: true,
         yptId: parsed.data.yptId,
      };
   } catch (error) {
      return {
         ok: false,
         code: "LINK_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "Failed to link YPT account.",
      };
   }
}

export async function importYptLogsAction(input: YptManualImportPayload) {
   try {
      const user = await requireSessionUser();
      const parsed = yptManualImportSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message ||
            (parsed.error as any).errors?.[0]?.message ||
            "Invalid import records payload.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      let importedCount = 0;
      let totalCoinsCredited = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      for (const record of parsed.data.records) {
         const result = await ingestYptActivity(
            {
               discordId: user.id,
               date: record.date,
               durationSeconds: record.durationSeconds,
               yptSubject: record.subject,
               externalActivityId: record.externalActivityId,
            },
            "YPT_MANUAL"
         );

         if (result.ok) {
            if (result.isDuplicate) {
               duplicateCount += 1;
            } else {
               importedCount += 1;
               totalCoinsCredited += result.coinsCredited;
            }
         } else {
            errors.push(
               `${record.date}: ${result.message || "Failed to import"}`
            );
         }
      }

      revalidatePath("/");
      revalidatePath("/wallet");
      revalidatePath("/dashboard");

      return {
         ok: true,
         importedCount,
         totalCoinsCredited,
         duplicateCount,
         errors: errors.length > 0 ? errors : undefined,
      };
   } catch (error) {
      return {
         ok: false,
         code: "IMPORT_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "Failed to process manual YPT import.",
      };
   }
}
