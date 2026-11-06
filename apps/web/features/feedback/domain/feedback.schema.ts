import { z } from "zod";
import {
   isInternalPageUrl,
   toSafeLogRocketUrl,
} from "@/features/feedback/domain/feedback-links";

export const feedbackTypeEnum = z.enum(["bug", "enhancement"]);

export const createFeedbackSchema = z.object({
   type: feedbackTypeEnum,
   title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(120, "Title cannot exceed 120 characters"),
   description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(2000, "Description cannot exceed 2000 characters"),
   url: z
      .string()
      .trim()
      .max(1024, "URL cannot exceed 1024 characters")
      .refine(
         (value) => isInternalPageUrl(value),
         "URL must be a page within the app"
      ),
   logrocketSessionId: z
      .string()
      .trim()
      .max(1024)
      .refine(
         (value) => value === "" || toSafeLogRocketUrl(value) !== null,
         "Session link must be a LogRocket URL"
      )
      .optional()
      .nullable(),
   attachments: z
      .array(z.string().trim().min(1).max(512))
      .max(3, "You can attach at most 3 files")
      .optional()
      .default([]),
});

export type CreateFeedbackSchemaInput = z.infer<typeof createFeedbackSchema>;
