-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT,
    "actor_id" TEXT,
    "actor_username" TEXT NOT NULL,
    "actor_display_name" TEXT,
    "actor_image" TEXT,
    "action_type" VARCHAR(64) NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "target_entity_type" VARCHAR(64) NOT NULL,
    "target_entity_name" VARCHAR(255),
    "previous_value" JSONB,
    "new_value" JSONB,
    "audit_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_challenge_id_created_at_idx" ON "audit_logs"("challenge_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs"("action_type");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
