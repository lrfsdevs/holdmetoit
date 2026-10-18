import { prisma } from "@/core/db";
import {
   createAuditEnvelope,
   type AuditEvent,
   type AuditEventType,
   type AuditTargetType,
   type CreateAuditEventParams,
} from "@/features/audit/domain/audit-log";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("audit");

// Append-only in-memory storage for test isolation and fallback
const inMemoryAuditTrail: AuditEvent[] = [];
let forceInMemoryForTests = false;

export function _setUseInMemoryAuditTrailForTests(value: boolean): void {
   forceInMemoryForTests = value;
}

export function _clearAuditTrailForTests(): void {
   inMemoryAuditTrail.length = 0;
}

/**
 * Appends a new immutable audit record to the system audit trail (FEAT-AUDIT-01).
 * Invariant: Strictly append-only. No update or delete operations are exposed.
 */
export async function recordAuditEvent(
   params: CreateAuditEventParams
): Promise<AuditEvent> {
   const envelope = createAuditEnvelope(params);

   // In test environments or when forced, record in memory
   if (forceInMemoryForTests || process.env.NODE_ENV === "test") {
      inMemoryAuditTrail.push(Object.freeze({ ...envelope }));
   }

   if (forceInMemoryForTests) {
      return envelope;
   }

   try {
      // Look up actor displayName and image if not already provided
      let displayName = envelope.actorDisplayName;
      let image = envelope.actorImage;

      if ((!displayName || !image) && envelope.actorId) {
         try {
            const actorUser = await prisma.user.findUnique({
               where: { id: envelope.actorId },
               select: { displayName: true, image: true },
            });
            if (actorUser) {
               displayName = displayName || actorUser.displayName;
               image = image || actorUser.image;
            }
         } catch {
            // Non-critical actor hydration lookup error
         }
      }

      const created = await prisma.auditLog.create({
         data: {
            id: envelope.id,
            challengeId: envelope.challengeId ?? null,
            actorId: envelope.actorId,
            actorUsername: envelope.actorUsername,
            actorDisplayName: displayName ?? null,
            actorImage: image ?? null,
            actionType: envelope.actionType,
            targetEntityId: envelope.targetEntityId,
            targetEntityType: envelope.targetEntityType,
            targetEntityName: envelope.targetEntityName ?? null,
            previousValue: envelope.previousValue as any,
            newValue: envelope.newValue as any,
            auditReason: envelope.auditReason,
            createdAt: new Date(envelope.timestamp),
         },
      });

      return {
         ...envelope,
         actorDisplayName: created.actorDisplayName,
         actorImage: created.actorImage,
         targetEntityName: created.targetEntityName,
      };
   } catch (error) {
      if (process.env.NODE_ENV !== "test") {
         logger.error(logEvents.auditPersistFailed, {
            context: {
               challengeId: envelope.challengeId,
               actorId: envelope.actorId,
               actionType: envelope.actionType,
            },
            error,
         });
      }
      return envelope;
   }
}

/**
 * Retrieves the audit trail, optionally filtered by challengeId, sorted descending by timestamp.
 */
export async function getAuditTrail(
   challengeId?: string
): Promise<AuditEvent[]> {
   if (forceInMemoryForTests) {
      const filtered = challengeId
         ? inMemoryAuditTrail.filter(
              (event) => event.challengeId === challengeId
           )
         : inMemoryAuditTrail;

      return [...filtered]
         .reverse()
         .sort(
            (a, b) =>
               new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
         );
   }

   try {
      const logs = await prisma.auditLog.findMany({
         where: challengeId ? { challengeId } : undefined,
         orderBy: { createdAt: "desc" },
         include: {
            actor: {
               select: {
                  displayName: true,
                  username: true,
                  image: true,
               },
            },
         },
      });

      if (logs && logs.length > 0) {
         return logs.map((log) => ({
            id: log.id,
            timestamp: log.createdAt.toISOString(),
            actorId: log.actorId ?? "system",
            actorUsername: log.actorUsername,
            actorDisplayName: log.actor?.displayName ?? log.actorDisplayName,
            actorImage: log.actor?.image ?? log.actorImage,
            actionType: log.actionType as AuditEventType,
            targetEntityId: log.targetEntityId,
            targetEntityType: log.targetEntityType as AuditTargetType,
            targetEntityName: log.targetEntityName,
            challengeId: log.challengeId ?? undefined,
            previousValue: log.previousValue,
            newValue: log.newValue,
            auditReason: log.auditReason,
         }));
      }
   } catch (error) {
      if (process.env.NODE_ENV !== "test") {
         logger.error(logEvents.auditQueryFailed, {
            context: { challengeId },
            error,
         });
      }
   }

   // Fallback to in-memory storage (e.g. for unit tests)
   const filtered = challengeId
      ? inMemoryAuditTrail.filter((event) => event.challengeId === challengeId)
      : inMemoryAuditTrail;

   return [...filtered]
      .reverse()
      .sort(
         (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
}
