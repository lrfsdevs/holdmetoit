"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogOut, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { trackLogRocketEvent } from "@/core/observability/logrocket";
import {
   loginWithDiscordAction,
   logoutAction,
} from "@/features/auth/api/auth.actions";
import {
   hasAdminPrivileges,
   isDevRole,
} from "@/features/auth/domain/auth-roles";
import { PreviewModeHotkey } from "@/features/auth/presentation/preview-mode-hotkey";

export function SignInWithDiscordButton({
   redirectTo = "/",
   className,
   size = "default",
   variant = "default",
}: {
   redirectTo?: string;
   className?: string;
   size?: "default" | "sm" | "lg" | "icon";
   variant?: "default" | "secondary" | "outline" | "ghost";
}) {
   const handleSignIn = loginWithDiscordAction.bind(null, redirectTo);

   return (
      <form
         action={handleSignIn}
         className="inline-block"
         onSubmit={() => trackLogRocketEvent("DiscordSignInClicked")}
      >
         <Button
            type="submit"
            variant={variant}
            size={size}
            className={className}
         >
            <DiscordIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="sm:hidden">Sign In</span>
            <span className="hidden sm:inline">Sign In with Discord</span>
         </Button>
      </form>
   );
}

export function SignOutButton({
   className = "",
   size = "sm",
}: {
   className?: string;
   size?: "default" | "sm" | "lg" | "icon";
}) {
   return (
      <form
         action={logoutAction}
         className="inline-block shrink-0"
         onSubmit={() => trackLogRocketEvent("DiscordSignOutClicked")}
      >
         <Button
            type="submit"
            variant="ghost"
            size={size}
            aria-label="Sign Out"
            className={`h-8 px-2 sm:px-2.5 text-xs text-white hover:text-text-secondary hover:bg-nav-hover transition-colors gap-1.5 ${className}`}
         >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
         </Button>
      </form>
   );
}

export interface UserNavProps {
   user?: {
      id?: string;
      name?: string | null;
      displayName?: string | null;
      username?: string | null;
      image?: string | null;
      role?: string;
      discordId?: string | null;
   } | null;
   redirectTo?: string;
   isPreviewActive?: boolean;
   profileUrl?: string;
}

export function UserNav({
   user,
   redirectTo,
   isPreviewActive,
   profileUrl,
}: UserNavProps) {
   if (!user) {
      return (
         <SignInWithDiscordButton
            redirectTo={redirectTo}
            size="sm"
            className="bg-feedback-info hover:bg-feedback-info text-white text-xs h-8 px-3.5 rounded-full font-medium"
         />
      );
   }

   const effectiveIsPreviewActive = isPreviewActive ?? false;

   const displayName =
      user.displayName || user.name || user.username || "Companion";
   const initial = displayName.charAt(0).toUpperCase();
   const isDev = isDevRole(user.role) && !effectiveIsPreviewActive;
   const activeProfileUrl = profileUrl ?? "/profile";

   return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
         {/* User Capsule */}
         <Link
            href={activeProfileUrl}
            title={`View profile for ${displayName}`}
            data-testid="user-profile-link"
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border-strong bg-surface-elevated hover:bg-surface-nested hover:border-border-strong px-2 sm:px-2.5 py-1 text-xs shrink-0 max-w-[130px] sm:max-w-none transition-colors group cursor-pointer"
         >
            <div className="relative h-5 w-5 overflow-hidden rounded-full border border-input-bg bg-surface-nested shrink-0 group-hover:border-border-strong transition-colors">
               <UserAvatar
                  src={user.image}
                  name={displayName}
                  userId={user.id}
                  discordId={user.discordId}
                  size="xs"
                  className="h-full w-full border-0"
               />
            </div>

            <span className="max-w-[45px] xs:max-w-[75px] sm:max-w-[130px] truncate font-medium text-text-primary group-hover:text-white transition-colors">
               {displayName}
            </span>

            {isDev && (
               <span
                  data-testid="dev-role-badge"
                  className="hidden sm:inline rounded-full bg-brand-2/20 border border-brand-2/50 text-brand-2 px-1.5 py-0.5 text-caption font-bold uppercase tracking-wider select-none shrink-0"
                  title="Developer Role"
               >
                  DEV
               </span>
            )}
         </Link>

         <SignOutButton />
      </div>
   );
}

/**
 * Renders scrollable navigation and account controls using the effective preview role.
 */
export function AppHeader({
   user,
   isActualAdmin,
   isPreviewActive,
   showPokemonNav = true,
   showLeaderboardNav = true,
   showWalletNav = true,
}: {
   user?: UserNavProps["user"];
   isActualAdmin?: boolean;
   isPreviewActive?: boolean;
   showPokemonNav?: boolean;
   showLeaderboardNav?: boolean;
   showWalletNav?: boolean;
}) {
   const searchParams = useSearchParams();

   const resolvedIsActualAdmin =
      isActualAdmin ?? hasAdminPrivileges(user?.role);
   const urlPreview =
      resolvedIsActualAdmin && searchParams.get("as") === "participant";
   const previewActive = (isPreviewActive ?? false) || urlPreview;
   const effectiveUser =
      previewActive && user ? { ...user, role: "PARTICIPANT" } : user;

   return (
      <header className="sticky top-0 z-40 h-16 border-b border-border-subtle bg-nav-bg/95 backdrop-blur-md">
         <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 min-w-0 px-3 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-x-auto scrollbar-none py-1">
               <Link
                  href="/"
                  className="flex items-center gap-2 sm:gap-2.5 group shrink-0"
               >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-text-inverse shadow-sm shrink-0">
                     <Shield className="h-3.5 w-3.5 fill-current" />
                  </div>
                  <span className="hidden sm:inline font-semibold text-sm sm:text-base tracking-tight text-text-primary group-hover:text-white transition-colors">
                     HoldMeToIt
                  </span>
               </Link>

               <Link
                  href="/challenges"
                  className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
               >
                  Challenges
               </Link>

               <Link
                  href="/changelog"
                  className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
               >
                  Changelog
               </Link>

               {showWalletNav && (
                  <Link
                     href="/wallet"
                     data-testid="wallet-nav-link"
                     className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
                  >
                     Wallet
                  </Link>
               )}

               {showLeaderboardNav && (
                  <Link
                     href="/leaderboard"
                     data-testid="trophy-leaderboard-nav-link"
                     className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
                  >
                     Leaderboard
                  </Link>
               )}

               {showPokemonNav && (
                  <Link
                     href="/pokemon"
                     data-testid="pokemon-nav-link"
                     className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
                  >
                     Pokédex
                  </Link>
               )}

               {isDevRole(effectiveUser?.role) && (
                  <Link
                     href="/devboard"
                     data-testid="devboard-nav-link"
                     className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
                  >
                     DevBoard
                  </Link>
               )}

               {resolvedIsActualAdmin && !previewActive && (
                  <Link
                     href="/admin"
                     data-testid="admin-nav-link"
                     className="text-xs sm:text-sm font-medium text-nav-text hover:text-nav-active transition-colors border-l border-border-default pl-2 sm:pl-3 shrink-0"
                  >
                     Admin
                  </Link>
               )}
            </div>

            <UserNav
               user={effectiveUser}
               redirectTo="/"
               isPreviewActive={previewActive}
            />

            <PreviewModeHotkey
               isActualAdmin={resolvedIsActualAdmin}
               isPreviewActive={previewActive}
            />
         </div>
      </header>
   );
}
