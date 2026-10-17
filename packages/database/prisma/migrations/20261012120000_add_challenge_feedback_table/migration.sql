-- CreateTable
CREATE TABLE "challenge_feedbacks" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consistency" TEXT NOT NULL,
    "fairness_rating" INTEGER NOT NULL,
    "tracking_preference" TEXT NOT NULL,
    "team_battle_feedback" TEXT,
    "work_school_hours" TEXT NOT NULL,
    "solo_style" TEXT NOT NULL,
    "solo_punishment" TEXT NOT NULL,
    "solo_ideas" TEXT,
    "discord_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challenge_feedbacks_challenge_id_user_id_key" ON "challenge_feedbacks"("challenge_id", "user_id");

-- CreateIndex
CREATE INDEX "challenge_feedbacks_challenge_id_created_at_idx" ON "challenge_feedbacks"("challenge_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "challenge_feedbacks_user_id_idx" ON "challenge_feedbacks"("user_id");

-- AddForeignKey
ALTER TABLE "challenge_feedbacks" ADD CONSTRAINT "challenge_feedbacks_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_feedbacks" ADD CONSTRAINT "challenge_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
