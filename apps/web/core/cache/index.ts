import { revalidateTag, unstable_cache } from "next/cache";

export const CACHE_REVALIDATE_SECONDS = {
   live: 15,
   standard: 60,
   stable: 300,
} as const;

export const cacheTags = {
   challengeScoreboard: (challengeId: string) =>
      `challenge:${challengeId}:scoreboard`,
   challengeMetadata: (challengeId: string) =>
      `challenge:${challengeId}:metadata`,
   userTasks: (userId: string) => `user:${userId}:tasks`,
   participantCockpit: (userId: string, challengeId: string) =>
      `user:${userId}:challenge:${challengeId}:cockpit`,
} as const;

/** Wraps an async read in Next cache with explicit keys, tags, and revalidation. */
export function cacheRead<TArgs extends readonly unknown[], TResult>(
   read: (...args: TArgs) => Promise<TResult>,
   options: {
      keyParts: readonly string[];
      revalidate: number;
      tags: readonly string[];
   }
): (...args: TArgs) => Promise<TResult> {
   return unstable_cache(read, [...options.keyParts], {
      revalidate: options.revalidate,
      tags: [...options.tags],
   }) as (...args: TArgs) => Promise<TResult>;
}

/** Invalidates each supplied cache tag after a mutation. */
export function invalidateTags(tags: readonly string[]): void {
   for (const tag of tags) {
      revalidateTag(tag);
   }
}
