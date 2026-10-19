/**
 * Pure helpers for feedback image/video attachments (FEAT-FEED-01).
 * Zero framework / ORM / SDK imports (Law L7).
 */

export const FEEDBACK_ATTACHMENT_MAX_FILES = 3;
export const FEEDBACK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const FEEDBACK_ATTACHMENT_ACCEPT =
   "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export type FeedbackAttachmentKind = "image" | "video";

export type FeedbackAttachmentExt =
   "png" | "jpg" | "webp" | "gif" | "mp4" | "webm" | "mov";

export const FEEDBACK_ATTACHMENT_MIME_TO_EXT: Record<
   string,
   { ext: FeedbackAttachmentExt; kind: FeedbackAttachmentKind }
> = {
   "image/png": { ext: "png", kind: "image" },
   "image/jpeg": { ext: "jpg", kind: "image" },
   "image/webp": { ext: "webp", kind: "image" },
   "image/gif": { ext: "gif", kind: "image" },
   "video/mp4": { ext: "mp4", kind: "video" },
   "video/webm": { ext: "webm", kind: "video" },
   "video/quicktime": { ext: "mov", kind: "video" },
};

export const FEEDBACK_ATTACHMENT_EXT_TO_MIME: Record<
   FeedbackAttachmentExt,
   string
> = {
   png: "image/png",
   jpg: "image/jpeg",
   webp: "image/webp",
   gif: "image/gif",
   mp4: "video/mp4",
   webm: "video/webm",
   mov: "video/quicktime",
};

export const FEEDBACK_ATTACHMENT_EXT_TO_KIND: Record<
   FeedbackAttachmentExt,
   FeedbackAttachmentKind
> = {
   png: "image",
   jpg: "image",
   webp: "image",
   gif: "image",
   mp4: "video",
   webm: "video",
   mov: "video",
};

const EXT_FILE_PATTERN = /^[A-Za-z0-9_-]+\.(png|jpg|webp|gif|mp4|webm|mov)$/;

export interface FeedbackAttachmentUrlConfig {
   supabaseUrl: string;
   bucket: string;
   folder: string;
}

export type FeedbackAttachmentMetaValidation =
   | {
        ok: true;
        ext: FeedbackAttachmentExt;
        kind: FeedbackAttachmentKind;
        contentType: string;
     }
   | { ok: false; reason: string };

export function resolveFeedbackAttachmentKind(
   mimeType: string
): FeedbackAttachmentKind | null {
   return FEEDBACK_ATTACHMENT_MIME_TO_EXT[mimeType]?.kind ?? null;
}

export function maxBytesForKind(kind: FeedbackAttachmentKind): number {
   return kind === "image"
      ? FEEDBACK_IMAGE_MAX_BYTES
      : FEEDBACK_VIDEO_MAX_BYTES;
}

/** Validates client-declared metadata. Contents are verified server-side after upload. */
export function validateFeedbackAttachmentMeta(file: {
   mimeType: string;
   sizeBytes: number;
}): FeedbackAttachmentMetaValidation {
   if (!file.sizeBytes || file.sizeBytes <= 0) {
      return { ok: false, reason: "The selected file is empty." };
   }

   const mapping = FEEDBACK_ATTACHMENT_MIME_TO_EXT[file.mimeType];
   if (!mapping) {
      return {
         ok: false,
         reason:
            "Only PNG, JPEG, WebP, GIF images or MP4, WebM, MOV videos are allowed.",
      };
   }

   if (file.sizeBytes > maxBytesForKind(mapping.kind)) {
      return {
         ok: false,
         reason:
            mapping.kind === "image"
               ? "Images must be 5 MB or smaller."
               : "Videos must be 50 MB or smaller.",
      };
   }

   return {
      ok: true,
      ext: mapping.ext,
      kind: mapping.kind,
      contentType: FEEDBACK_ATTACHMENT_EXT_TO_MIME[mapping.ext],
   };
}

function ascii(
   bytes: Uint8Array,
   start: number,
   length: number
): string | null {
   if (bytes.length < start + length) return null;
   let value = "";
   for (let index = start; index < start + length; index += 1) {
      value += String.fromCharCode(bytes[index]);
   }
   return value;
}

/** Derives the true extension from magic bytes, never from client claims. */
export function sniffFeedbackAttachmentExt(
   header: Uint8Array
): FeedbackAttachmentExt | null {
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

   const gifSignature = ascii(header, 0, 6);
   if (gifSignature === "GIF87a" || gifSignature === "GIF89a") {
      return "gif";
   }

   if (
      header.length >= 4 &&
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3
   ) {
      return "webm";
   }

   if (header.length >= 12 && ascii(header, 4, 4) === "ftyp") {
      return ascii(header, 8, 4) === "qt  " ? "mov" : "mp4";
   }

   return null;
}

export function buildFeedbackAttachmentObjectPath(
   folder: string,
   id: string,
   ext: FeedbackAttachmentExt
): string {
   const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
   return `${cleanFolder}/${id}.${ext}`;
}

export interface ParsedFeedbackAttachmentPath {
   ext: FeedbackAttachmentExt;
   kind: FeedbackAttachmentKind;
   mimeType: string;
}

/**
 * Validates a stored object path and returns its metadata. Rejects nesting,
 * traversal, query/fragment suffixes, and unknown extensions.
 */
export function parseFeedbackAttachmentPath(
   path: string,
   folder: string
): ParsedFeedbackAttachmentPath | null {
   if (typeof path !== "string") return null;

   const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
   const prefix = `${cleanFolder}/`;
   if (!path.startsWith(prefix)) return null;

   const fileName = path.slice(prefix.length);
   const match = EXT_FILE_PATTERN.exec(fileName);
   if (!match) return null;

   const ext = match[1] as FeedbackAttachmentExt;
   return {
      ext,
      kind: FEEDBACK_ATTACHMENT_EXT_TO_KIND[ext],
      mimeType: FEEDBACK_ATTACHMENT_EXT_TO_MIME[ext],
   };
}

function publicPrefix(config: FeedbackAttachmentUrlConfig): string {
   const base = config.supabaseUrl.replace(/\/+$/, "");
   const folder = config.folder.replace(/^\/+|\/+$/g, "");
   return `${base}/storage/v1/object/public/${config.bucket}/${folder}/`;
}

/** Returns the storage object path when the URL points inside our managed folder. */
export function extractFeedbackAttachmentObjectPath(
   url: string | null | undefined,
   config: FeedbackAttachmentUrlConfig
): string | null {
   if (!url) return null;

   const prefix = publicPrefix(config);
   if (!url.startsWith(prefix)) return null;

   const fileName = url.slice(prefix.length);
   if (!EXT_FILE_PATTERN.test(fileName)) return null;

   const folder = config.folder.replace(/^\/+|\/+$/g, "");
   return `${folder}/${fileName}`;
}
