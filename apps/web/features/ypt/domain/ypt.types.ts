import { z } from "zod";

export const yptIngestSchema = z
   .object({
      discordId: z.string().min(1).optional(),
      yptId: z.string().min(1).optional(),
      date: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
      durationSeconds: z
         .number()
         .int()
         .min(0, "Duration cannot be negative")
         .max(86400, "Duration cannot exceed 24 hours"),
      yptSubject: z.string().max(128).optional(),
      externalActivityId: z.string().max(128).optional(),
   })
   .refine((data) => Boolean(data.discordId || data.yptId), {
      message: "At least one of discordId or yptId must be provided.",
      path: ["discordId"],
   });

export type YptIngestPayload = z.infer<typeof yptIngestSchema>;

export interface YptIngestResult {
   ok: boolean;
   userId?: string;
   participantId?: string;
   studyLogId?: string;
   durationSeconds: number;
   coinsCredited: number;
   isDuplicate: boolean;
   message?: string;
   code?: string;
}

export const yptManualImportItemSchema = z.object({
   date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
   durationSeconds: z
      .number()
      .int()
      .min(0, "Duration cannot be negative")
      .max(86400, "Duration cannot exceed 24 hours"),
   subject: z.string().max(128).optional(),
   externalActivityId: z.string().max(128).optional(),
});

export const yptManualImportSchema = z.object({
   records: z
      .array(yptManualImportItemSchema)
      .min(1, "At least one record is required")
      .max(100, "Maximum 100 records per import"),
});

export type YptManualImportPayload = z.infer<typeof yptManualImportSchema>;
