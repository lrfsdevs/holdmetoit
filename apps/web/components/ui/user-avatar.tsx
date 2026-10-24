"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
   getDiscordDefaultAvatarUrl,
   getInitials,
   parseDiscordAvatarUrl,
} from "@/features/auth/domain/discord-avatar";
import { cn } from "@/lib/utils";

// Module-level cache to prevent duplicate background sync requests per session
const syncedIdentities = new Set<string>();

export interface UserAvatarProps extends React.ComponentPropsWithoutRef<
   typeof Avatar
> {
   src?: string | null;
   alt?: string;
   name?: string | null;
   discordId?: string | null;
   userId?: string | null;
   imageClassName?: string;
   fallbackClassName?: string;
   size?: "xs" | "sm" | "md" | "lg" | "xl";
   autoSyncOn404?: boolean;
}

const sizeClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
   xs: "h-5 w-5 text-label",
   sm: "h-7 w-7 text-caption",
   md: "h-9 w-9 text-caption",
   lg: "h-12 w-12 text-body",
   xl: "h-16 w-16 text-body sm:h-20 sm:w-20 sm:text-display-sm",
};

/**
 * Resilient user avatar component.
 * Gracefully handles deleted/stale Discord CDN avatars, 404 errors, and fallbacks.
 * Automatically pings the background sync endpoint to heal stale avatar records in DB.
 */
export const UserAvatar = React.forwardRef<
   React.ElementRef<typeof Avatar>,
   UserAvatarProps
>(
   (
      {
         src,
         alt,
         name,
         discordId,
         userId,
         className,
         imageClassName,
         fallbackClassName,
         size = "md",
         autoSyncOn404 = true,
         ...props
      },
      ref
   ) => {
      // Resolve effective discordId from prop or from Discord avatar URL
      const resolvedDiscordId = React.useMemo(() => {
         if (discordId) return discordId;
         if (src) {
            const parsed = parseDiscordAvatarUrl(src);
            if (parsed.isDiscordAvatar && parsed.discordId) {
               return parsed.discordId;
            }
         }
         return null;
      }, [discordId, src]);

      const [currentSrc, setCurrentSrc] = React.useState<string | null>(
         src ?? null
      );
      const [hasAttemptedDefaultFallback, setHasAttemptedDefaultFallback] =
         React.useState(false);

      // Sync local state if external src prop updates
      React.useEffect(() => {
         setCurrentSrc(src ?? null);
         setHasAttemptedDefaultFallback(false);
      }, [src]);

      const triggerBackgroundSync = React.useCallback(() => {
         if (!autoSyncOn404) return;
         const syncKey = userId ?? resolvedDiscordId;
         if (!syncKey || syncedIdentities.has(syncKey)) return;

         syncedIdentities.add(syncKey);

         // Non-blocking fire-and-forget sync
         fetch("/api/users/sync-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               userId: userId ?? undefined,
               discordId: resolvedDiscordId ?? undefined,
            }),
         }).catch(() => {
            // Silently ignore network failures in background self-heal
         });
      }, [autoSyncOn404, userId, resolvedDiscordId]);

      const handleLoadingStatusChange = (
         status: "idle" | "loading" | "loaded" | "error"
      ) => {
         if (status === "error") {
            triggerBackgroundSync();

            // If primary image failed and we have a discordId, attempt default Discord avatar first
            if (resolvedDiscordId && !hasAttemptedDefaultFallback) {
               const defaultUrl = getDiscordDefaultAvatarUrl(resolvedDiscordId);
               if (currentSrc !== defaultUrl) {
                  setHasAttemptedDefaultFallback(true);
                  setCurrentSrc(defaultUrl);
                  return;
               }
            }

            // Otherwise, drop to initials fallback
            setCurrentSrc(null);
         }
      };

      const initials = React.useMemo(() => getInitials(name), [name]);
      const accessibleAlt = alt || name || "User avatar";

      return (
         <Avatar
            ref={ref}
            className={cn(sizeClasses[size], className)}
            {...props}
         >
            {currentSrc ? (
               <AvatarImage
                  src={currentSrc}
                  alt={accessibleAlt}
                  className={cn("object-cover", imageClassName)}
                  onLoadingStatusChange={handleLoadingStatusChange}
               />
            ) : null}

            <AvatarFallback
               className={cn(
                  "font-semibold select-none bg-surface-elevated text-text-primary",
                  fallbackClassName
               )}
            >
               {initials}
            </AvatarFallback>
         </Avatar>
      );
   }
);

UserAvatar.displayName = "UserAvatar";
