import { z } from "zod";

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
   url: z.string().trim().max(1024, "URL cannot exceed 1024 characters"),
   logrocketSessionId: z.string().trim().max(1024).optional().nullable(),
});

export type CreateFeedbackSchemaInput = z.infer<typeof createFeedbackSchema>;
