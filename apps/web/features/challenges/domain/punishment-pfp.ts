/**
 * Pure helpers for challenge banner and Punishment PFP uploads (FEAT-CHAL-01, FEAT-PUN-03).
 * Zero framework / ORM / SDK imports (Law L7).
 */

export type ChallengeImagePurpose = "event-banner" | "punishment-pfp";

export function isChallengeImagePurpose(
   value: unknown
): value is ChallengeImagePurpose {
   return value === "event-banner" || value === "punishment-pfp";
}

export const PUNISHMENT_PFP_MAX_BYTES = 3 * 1024 * 1024;

export const PUNISHMENT_PFP_ACCEPT = "image/png,image/jpeg,image/webp";

export type PunishmentPfpExt = "png" | "jpg" | "webp";

export const PUNISHMENT_PFP_MIME_TO_EXT: Record<string, PunishmentPfpExt> = {
   "image/png": "png",
   "image/jpeg": "jpg",
   "image/webp": "webp",
};

export interface StorageUrlConfig {
   supabaseUrl: string;
   bucket: string;
   folder: string;
}

export type PunishmentPfpValidation =
   | { ok: true; ext: PunishmentPfpExt; contentType: string }
   | { ok: false; reason: string };

function sniffExt(header: Uint8Array): PunishmentPfpExt | null {
   if (
      header.length >= 4 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
   ) {
      return "png";
   }
   if (
      header.length >= 3 &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff
   ) {
      return "jpg";
   }
   if (
      header.length >= 12 &&
      header[0] === 0x52 && // R
      header[1] === 0x49 && // I
      header[2] === 0x46 && // F
      header[3] === 0x46 && // F
      header[8] === 0x57 && // W
      header[9] === 0x45 && // E
      header[10] === 0x42 && // B
      header[11] === 0x50 // P
   ) {
      return "webp";
   }
   return null;
}

const EXT_TO_MIME: Record<PunishmentPfpExt, string> = {
   png: "image/png",
   jpg: "image/jpeg",
   webp: "image/webp",
};

/**
 * Validates an uploaded punishment image. The extension and content type are
 * derived from the sniffed magic bytes, never from the client-claimed values.
 */
export function validatePunishmentPfpFile(file: {
   type: string;
   size: number;
   headerBytes: Uint8Array;
}): PunishmentPfpValidation {
   if (!file.size || file.size <= 0) {
      return { ok: false, reason: "The selected file is empty." };
   }
   if (file.size > PUNISHMENT_PFP_MAX_BYTES) {
      return { ok: false, reason: "Image must be 3 MB or smaller." };
   }
   if (!(file.type in PUNISHMENT_PFP_MIME_TO_EXT)) {
      return {
         ok: false,
         reason: "Only PNG, JPEG or WebP images are allowed.",
      };
   }

   const ext = sniffExt(file.headerBytes);
   if (!ext) {
      return {
         ok: false,
         reason: "Only PNG, JPEG or WebP images are allowed.",
      };
   }
   if (PUNISHMENT_PFP_MIME_TO_EXT[file.type] !== ext) {
      return {
         ok: false,
         reason: "File contents do not match the declared image type.",
      };
   }

   return { ok: true, ext, contentType: EXT_TO_MIME[ext] };
}

export function buildChallengeImageObjectPath(
   folder: string,
   id: string,
   ext: PunishmentPfpExt
): string {
   const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
   return `${cleanFolder}/${id}.${ext}`;
}

function publicPrefix(config: StorageUrlConfig): string {
   const base = config.supabaseUrl.replace(/\/+$/, "");
   const folder = config.folder.replace(/^\/+|\/+$/g, "");
   return `${base}/storage/v1/object/public/${config.bucket}/${folder}/`;
}

/**
 * Returns the storage object path (e.g. `event-banners/<uuid>.png`) when the
 * URL is a public URL inside our managed folder; otherwise `null`.
 * This is the guard that keeps cleanup away from legacy/external assets.
 */
export function extractManagedObjectPath(
   url: string | null | undefined,
   config: StorageUrlConfig
): string | null {
   if (!url) return null;
   const prefix = publicPrefix(config);
   if (!url.startsWith(prefix)) return null;

   const fileName = url.slice(prefix.length);
   // Only a single flat file name: no nesting, traversal, query or fragment.
   if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp)$/.test(fileName)) return null;

   const folder = config.folder.replace(/^\/+|\/+$/g, "");
   return `${folder}/${fileName}`;
}

/**
 * Cross-origin `<a download>` is ignored by browsers, so for managed Supabase
 * URLs we append `?download=` to make Storage reply with
 * `Content-Disposition: attachment`. Other URLs are returned unchanged.
 */
export function toDownloadUrl(url: string, filename: string): string {
   if (
      !/^https?:\/\//.test(url) ||
      !url.includes("/storage/v1/object/public/")
   ) {
      return url;
   }
   const separator = url.includes("?") ? "&" : "?";
   return `${url}${separator}download=${encodeURIComponent(filename)}`;
}
