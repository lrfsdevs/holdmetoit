/**
 * Pure domain utilities for Discord avatar URLs and fallbacks.
 * Adheres strictly to Law L7 (Pure Domain Isolation, zero framework/DB imports).
 */

/**
 * Calculates the Discord default embed avatar URL.
 * Discord rules:
 * - Legacy discriminator (not "0"): (discriminator % 5)
 * - Modern username / Pomelo (discriminator "0" or omitted): (BigInt(discordId) >> 22n) % 6n
 * - Fallback: index 0
 */
export function getDiscordDefaultAvatarUrl(
   discordId?: string | null,
   discriminator?: string | null
): string {
   if (discriminator && discriminator !== "0") {
      const parsed = parseInt(discriminator, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
         const index = parsed % 5;
         return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
      }
   }

   if (discordId) {
      try {
         const snowflake = BigInt(discordId);
         const index = Number((snowflake >> BigInt(22)) % BigInt(6));
         return `https://cdn.discordapp.com/embed/avatars/${Math.abs(index)}.png`;
      } catch {
         // Invalid snowflake format, fallback to default index 0
      }
   }

   return "https://cdn.discordapp.com/embed/avatars/0.png";
}

export interface BuildDiscordAvatarOptions {
   size?: number;
   format?: "png" | "webp" | "gif";
}

/**
 * Builds the canonical Discord CDN avatar URL, or defaults to the embed avatar if hash is absent.
 */
export function buildDiscordAvatarUrl(
   discordId: string,
   avatarHash?: string | null,
   options?: BuildDiscordAvatarOptions
): string {
   if (!avatarHash) {
      return getDiscordDefaultAvatarUrl(discordId);
   }

   const isAnimated = avatarHash.startsWith("a_");
   const format = options?.format ?? (isAnimated ? "gif" : "png");
   const sizeQuery = options?.size ? `?size=${options.size}` : "";

   return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${format}${sizeQuery}`;
}

export interface DiscordAvatarUrlInfo {
   isDiscordAvatar: boolean;
   discordId?: string;
   avatarHash?: string;
}

/**
 * Parses a Discord avatar URL to extract user snowflake and hash.
 */
export function parseDiscordAvatarUrl(
   url?: string | null
): DiscordAvatarUrlInfo {
   if (!url) {
      return { isDiscordAvatar: false };
   }

   const match = url.match(
      /cdn\.discordapp\.com\/avatars\/(\d+)\/([a-zA-Z0-9_]+)/
   );

   if (!match || !match[1] || !match[2]) {
      return { isDiscordAvatar: false };
   }

   return {
      isDiscordAvatar: true,
      discordId: match[1],
      avatarHash: match[2],
   };
}

/**
 * Extracts a 1-2 character uppercase initials representation for user fallback.
 */
export function getInitials(name?: string | null): string {
   if (!name || !name.trim()) {
      return "?";
   }

   const cleaned = name.trim();
   const words = cleaned.split(/\s+/).filter(Boolean);

   if (words.length >= 2) {
      const first = words[0]?.[0] ?? "";
      const last = words[words.length - 1]?.[0] ?? "";
      return (first + last).toUpperCase();
   }

   return cleaned.slice(0, 2).toUpperCase();
}
