import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
   buildChallengeImageObjectPath,
   extractManagedObjectPath,
   isChallengeImagePurpose,
   type ChallengeImagePurpose,
   type PunishmentPfpExt,
   type StorageUrlConfig,
} from "@/features/challenges/domain/punishment-pfp";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("storage");

/** Server-side only: this client uses the service-role key, never browser credentials. */
export interface StorageConfig {
   supabaseUrl: string;
   serviceRoleKey: string;
   bucket: string;
   eventBannersFolder: string;
   punishmentPfpsFolder: string;
}

export function getStorageConfig(): StorageConfig {
   const required = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
      SUPABASE_EVENT_BANNERS_FOLDER: process.env.SUPABASE_EVENT_BANNERS_FOLDER,
      SUPABASE_PUNISHMENT_PFPS_FOLDER:
         process.env.SUPABASE_PUNISHMENT_PFPS_FOLDER,
   };

   for (const [name, value] of Object.entries(required)) {
      if (!value?.trim()) {
         throw new Error(`Missing required environment variable: ${name}`);
      }
   }

   const folder = (value: string, name: string) => {
      const normalized = value.trim().replace(/^\/+|\/+$/g, "");
      if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalized)) {
         throw new Error(`Invalid storage folder: ${name}`);
      }
      return normalized;
   };
   const eventBannersFolder = folder(
      required.SUPABASE_EVENT_BANNERS_FOLDER!,
      "SUPABASE_EVENT_BANNERS_FOLDER"
   );
   const punishmentPfpsFolder = folder(
      required.SUPABASE_PUNISHMENT_PFPS_FOLDER!,
      "SUPABASE_PUNISHMENT_PFPS_FOLDER"
   );
   if (eventBannersFolder === punishmentPfpsFolder) {
      throw new Error(
         "Event banners and punishment PFPs must use different storage folders."
      );
   }

   return {
      supabaseUrl: required.SUPABASE_URL!.trim().replace(/\/+$/, ""),
      serviceRoleKey: required.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      bucket: required.SUPABASE_STORAGE_BUCKET!.trim(),
      eventBannersFolder,
      punishmentPfpsFolder,
   };
}

export function getStorageUrlConfig(
   purpose: ChallengeImagePurpose,
   config = getStorageConfig()
): StorageUrlConfig {
   if (!isChallengeImagePurpose(purpose)) {
      throw new Error("Invalid challenge image purpose.");
   }
   return {
      supabaseUrl: config.supabaseUrl,
      bucket: config.bucket,
      folder:
         purpose === "event-banner"
            ? config.eventBannersFolder
            : config.punishmentPfpsFolder,
   };
}

let cachedClient: { key: string; client: SupabaseClient } | null = null;

export function getSupabaseAdminClient(
   config = getStorageConfig()
): SupabaseClient {
   const key = `${config.supabaseUrl}|${config.serviceRoleKey}`;
   if (!cachedClient || cachedClient.key !== key) {
      cachedClient = {
         key,
         client: createClient(config.supabaseUrl, config.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
         }),
      };
   }
   return cachedClient.client;
}

export async function uploadChallengeImage(
   file: { bytes: ArrayBuffer; contentType: string; ext: PunishmentPfpExt },
   purpose: ChallengeImagePurpose
): Promise<{ url: string; path: string }> {
   const config = getStorageConfig();
   const { folder } = getStorageUrlConfig(purpose, config);
   const path = buildChallengeImageObjectPath(
      folder,
      crypto.randomUUID(),
      file.ext
   );
   const bucket = getSupabaseAdminClient(config).storage.from(config.bucket);
   const { error } = await bucket.upload(path, file.bytes, {
      contentType: file.contentType,
      cacheControl: "31536000",
      upsert: false,
   });

   if (error) throw new Error(`Failed to upload image: ${error.message}`);
   const { data } = bucket.getPublicUrl(path);
   return { url: data.publicUrl, path };
}

function managedImagePath(
   url: string | null | undefined,
   config: StorageConfig
) {
   return (
      extractManagedObjectPath(
         url,
         getStorageUrlConfig("event-banner", config)
      ) ??
      extractManagedObjectPath(
         url,
         getStorageUrlConfig("punishment-pfp", config)
      )
   );
}

export function isManagedChallengeImageUrl(
   url: string | null | undefined
): boolean {
   try {
      return managedImagePath(url, getStorageConfig()) !== null;
   } catch {
      return false;
   }
}

/** Storage deletion only; callers must first check references in both challenge columns. */
export async function deleteManagedChallengeImage(
   url: string | null | undefined
): Promise<void> {
   try {
      const config = getStorageConfig();
      const path = managedImagePath(url, config);
      if (!path) return;
      const { error } = await getSupabaseAdminClient(config)
         .storage.from(config.bucket)
         .remove([path]);
      if (error) {
         logger.warn(logEvents.storageCleanupSkipped, {
            context: { path, reason: error.message },
         });
      }
   } catch (error) {
      logger.error(logEvents.storageCleanupSkipped, { error });
   }
}
