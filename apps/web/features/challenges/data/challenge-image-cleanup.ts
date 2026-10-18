import {
   deleteManagedChallengeImage,
   isManagedChallengeImageUrl,
} from "@/core/storage/supabase-storage";
import { isChallengeImageReferenced } from "./punishment-pfp.repository";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("challenge.images");

/**
 * Replacements and migrated challenges may share an image. Only delete objects
 * no challenge references in either column, and never fail a committed save.
 */
export async function cleanupUnreferencedChallengeImages(
   urls: Array<string | null | undefined>
): Promise<void> {
   for (const url of Array.from(new Set(urls))) {
      if (!url || !isManagedChallengeImageUrl(url)) continue;
      try {
         if (!(await isChallengeImageReferenced(url))) {
            await deleteManagedChallengeImage(url);
         }
      } catch (error) {
         // If the reference check fails, retain the object rather than risking data loss.
         logger.error(logEvents.storageCleanupSkipped, {
            context: { url },
            error,
         });
      }
   }
}
