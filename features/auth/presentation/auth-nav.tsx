"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackLogRocketEvent } from "@/core/observability/logrocket";
import {
   loginWithDiscordAction,
   logoutAction,
} from "@/features/auth/api/auth.actions";
import { toggleParticipantPreviewAction } from "@/features/auth/api/preview-mode.actions";
import {
   hasAdminPrivileges,
   isDevRole,
} from "@/features/auth/domain/auth-roles";
import { PARTICIPANT_PREVIEW_COOKIE } from "@/features/auth/domain/preview-mode";

export function DiscordIcon({ className = "h-4 w-4" }: { className?: string }) {
   return (
      <svg
         role="img"
         viewBox="0 0 24 24"
         fill="currentColor"
         className={className}
         xmlns="http://www.w3.org/2000/svg"
         aria-hidden="true"
      >
         <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
   );
}

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
            <span>Sign In with Discord</span>
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
            className={`h-8 px-2 sm:px-2.5 text-xs text-[#ffffff] hover:text-[#d1d1d1] hover:bg-[#1c1c1c] transition-colors gap-1.5 ${className}`}
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
   } | null;
   redirectTo?: string;
   isActualAdmin?: boolean;
   isPreviewActive?: boolean;
   profileUrl?: string;
}

export function ParticipantPreviewButton({
   isPreviewActive,
   className = "",
}: {
   isPreviewActive: boolean;
   className?: string;
}) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();

   const handleToggle = () => {
      startTransition(async () => {
         const nextState = !isPreviewActive;
         // Optimistically update document.cookie
         if (typeof document !== "undefined") {
            if (nextState) {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=true; path=/; max-age=86400; SameSite=Lax`;
            } else {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
            }

            // Clean up URL query param if present
            if (window.location.search.includes("as=participant")) {
               const url = new URL(window.location.href);
               url.searchParams.delete("as");
               window.history.replaceState(
                  {},
                  "",
                  url.pathname + (url.search ? url.search : "")
               );
            }
         }

         await toggleParticipantPreviewAction(nextState);
         router.refresh();
      });
   };

   if (isPreviewActive) {
      return (
         <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleToggle}
            disabled={isPending}
            data-testid="exit-preview-button"
            className={`rounded-full bg-[#e08a32]/15 hover:bg-[#e08a32]/25 text-[#e08a32] hover:text-[#f5a742] border-[#e08a32]/40 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors shrink-0 gap-1.5 h-auto ${className}`}
            title="Exit Participant Preview and return to Developer / Moderator view"
         >
            <EyeOff className="h-3 w-3 shrink-0" />
            <span className="sm:hidden">Exit</span>
            <span className="hidden sm:inline">Exit Preview</span>
         </Button>
      );
   }

   return (
      <Button
         type="button"
         size="sm"
         variant="outline"
         onClick={handleToggle}
         disabled={isPending}
         data-testid="enter-preview-button"
         className={`rounded-full bg-[#1c1c1c] hover:bg-[#292929] text-[#b3b3b3] hover:text-[#f4f3f6] border-[#333333] px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors shrink-0 gap-1.5 h-auto ${className}`}
         title="Preview website globally as a regular participant (hides admin controls)"
      >
         <Eye className="h-3 w-3 shrink-0" />
         <span className="sm:hidden">Preview</span>
         <span className="hidden sm:inline">Preview as Participant</span>
      </Button>
   );
}

export function UserNav({
   user,
   redirectTo,
   isActualAdmin,
   isPreviewActive,
   profileUrl,
}: UserNavProps) {
   if (!user) {
      return (
         <SignInWithDiscordButton
            redirectTo={redirectTo}
            size="sm"
            className="bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs h-8 px-3.5 rounded-full font-medium"
         />
      );
   }

   const effectiveIsActualAdmin =
      isActualAdmin !== undefined
         ? isActualAdmin
         : hasAdminPrivileges(user.role);
   const effectiveIsPreviewActive = isPreviewActive ?? false;

   const displayName =
      user.displayName || user.name || user.username || "Companion";
   const initial = displayName.charAt(0).toUpperCase();
   const isDev = isDevRole(user.role) && !effectiveIsPreviewActive;
   const activeProfileUrl = profileUrl ?? "/profile";

   return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
         {/* Global Participant Preview Toggle Button for Admins/Devs */}
         {effectiveIsActualAdmin && (
            <ParticipantPreviewButton
               isPreviewActive={effectiveIsPreviewActive}
            />
         )}

         {/* User Capsule */}
         <Link
            href={activeProfileUrl}
            title={`View profile for ${displayName}`}
            data-testid="user-profile-link"
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#434343] bg-[#1c1c1c] hover:bg-[#252525] hover:border-[#666666] px-2 sm:px-2.5 py-1 text-xs shrink-0 max-w-[130px] sm:max-w-none transition-colors group cursor-pointer"
         >
            <div className="relative h-5 w-5 overflow-hidden rounded-full border border-[#545454] bg-[#292929] shrink-0 group-hover:border-[#777777] transition-colors">
               {user.image ? (
                  <Image
                     src={user.image}
                     alt={displayName}
                     fill
                     sizes="20px"
                     className="object-cover"
                  />
               ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#f4f3f6]">
                     {initial}
                  </span>
               )}
            </div>

            <span className="max-w-[45px] xs:max-w-[75px] sm:max-w-[130px] truncate font-medium text-[#f4f3f6] group-hover:text-white transition-colors">
               {displayName}
            </span>

            {isDev && (
               <span
                  data-testid="dev-role-badge"
                  className="rounded-full bg-[#e08a32]/20 border border-[#e08a32]/50 text-[#e08a32] px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider select-none shrink-0"
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

export function AppHeader({
   user,
   redirectTo,
   subtitle,
   isActualAdmin,
   isPreviewActive,
   profileUrl,
}: {
   user?: UserNavProps["user"];
   redirectTo?: string;
   subtitle?: string;
   isActualAdmin?: boolean;
   isPreviewActive?: boolean;
   profileUrl?: string;
}) {
   return (
      <header className="sticky top-0 z-40 h-16 border-b border-[#1f1f1f] bg-[#0d0d0d]/95 backdrop-blur-md">
         <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-3 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
               <Link
                  href="/"
                  className="flex items-center gap-2 sm:gap-2.5 group"
               >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#ffffff] text-[#0a080e] shadow-sm shrink-0">
                     <Shield className="h-3.5 w-3.5 fill-current" />
                  </div>
                  <span className="font-semibold text-sm sm:text-base tracking-tight text-[#f4f3f6] group-hover:text-white transition-colors">
                     HoldMeToIt
                  </span>
               </Link>

               <Link
                  href="/challenges"
                  className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3"
               >
                  Challenges
               </Link>

               {subtitle && (
                  <span className="hidden sm:inline-block text-xs text-[#868686] border-l border-[#292929] pl-2 sm:pl-3">
                     {subtitle}
                  </span>
               )}
            </div>

            <UserNav
               user={user}
               redirectTo={redirectTo}
               isActualAdmin={isActualAdmin}
               isPreviewActive={isPreviewActive}
               profileUrl={profileUrl}
            />
         </div>
      </header>
   );
}
