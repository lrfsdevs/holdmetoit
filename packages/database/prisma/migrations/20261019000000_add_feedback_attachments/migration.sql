-- CreateEnum
CREATE TYPE "FeedbackAttachmentKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "FeedbackAttachment" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "kind" "FeedbackAttachmentKind" NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAttachment_feedbackId_path_key" ON "FeedbackAttachment"("feedbackId", "path");

-- CreateIndex
CREATE INDEX "FeedbackAttachment_feedbackId_sortOrder_idx" ON "FeedbackAttachment"("feedbackId", "sortOrder");

-- AddForeignKey
ALTER TABLE "FeedbackAttachment" ADD CONSTRAINT "FeedbackAttachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
