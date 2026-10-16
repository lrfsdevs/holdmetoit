"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Eye, EyeOff, LogOut, Shield, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { trackLogRocketEvent } from "@/core/observability/logrocket";
import {
   loginWithDiscordAction,
   logoutAction,
} from "@/features/auth/api/auth.actions";
import { toggleParticipantPreviewAction } from "@/features/auth/api/preview-mode.actions";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import {
   hasAdminPrivileges,
   isDevRole,
} from "@/features/auth/domain/auth-roles";
import { PARTICIPANT_PREVIEW_COOKIE } from "@/features/auth/domain/preview-mode";

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

export function UserNav({
   user,
   redirectTo,
   isActualAdmin,
   isPreviewActive,
   profileUrl,
}: UserNavProps) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();

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

   const handleToggle = () => {
      startTransition(async () => {
         const nextState = !effectiveIsPreviewActive;

         if (typeof document !== "undefined") {
            if (nextState) {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=true; path=/; max-age=86400; SameSite=Lax`;
            } else {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
            }
         }

         await toggleParticipantPreviewAction(nextState);

         if (
            typeof window !== "undefined" &&
            window.location.search.includes("as=participant")
         ) {
            const url = new URL(window.location.href);
            url.searchParams.delete("as");
            router.replace(url.pathname + (url.search ? url.search : ""));
            return;
         }

         router.refresh();
      });
   };

   return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
         {/* Global Participant Preview Toggle Button for Admins/Devs */}
         {effectiveIsActualAdmin && (
            <Button
               type="button"
               size="sm"
               variant="outline"
               onClick={handleToggle}
               disabled={isPending}
               data-testid={
                  effectiveIsPreviewActive
                     ? "exit-preview-button"
                     : "enter-preview-button"
               }
               className={
                  effectiveIsPreviewActive
                     ? "rounded-full bg-[#e08a32]/15 hover:bg-[#e08a32]/25 text-[#e08a32] hover:text-[#f5a742] border-[#e08a32]/40 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors shrink-0 gap-1.5 h-auto"
                     : "rounded-full bg-[#1c1c1c] hover:bg-[#292929] text-[#b3b3b3] hover:text-[#f4f3f6] border-[#333333] px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors shrink-0 gap-1.5 h-auto"
               }
               title={
                  effectiveIsPreviewActive
                     ? "Exit Participant Preview and return to Developer / Moderator view"
                     : "Preview website globally as a regular participant (hides admin controls)"
               }
            >
               {effectiveIsPreviewActive ? (
                  <>
                     <EyeOff className="h-3 w-3 shrink-0" />
                     <span className="sm:hidden">Exit</span>
                     <span className="hidden sm:inline">Exit Preview</span>
                  </>
               ) : (
                  <>
                     <Eye className="h-3 w-3 shrink-0" />
                     <span className="sm:hidden">Preview</span>
                     <span className="hidden sm:inline">
                        Preview as Participant
                     </span>
                  </>
               )}
            </Button>
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
                  className="hidden sm:inline rounded-full bg-[#e08a32]/20 border border-[#e08a32]/50 text-[#e08a32] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider select-none shrink-0"
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
   isActualAdmin,
   isPreviewActive,
}: {
   user?: UserNavProps["user"];
   isActualAdmin?: boolean;
   isPreviewActive?: boolean;
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
      <header className="sticky top-0 z-40 h-16 border-b border-[#1f1f1f] bg-[#0d0d0d]/95 backdrop-blur-md">
         <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 min-w-0 px-3 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
               <Link
                  href="/"
                  className="flex items-center gap-2 sm:gap-2.5 group"
               >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#ffffff] text-[#0a080e] shadow-sm shrink-0">
                     <Shield className="h-3.5 w-3.5 fill-current" />
                  </div>
                  <span className="hidden sm:inline font-semibold text-sm sm:text-base tracking-tight text-[#f4f3f6] group-hover:text-white transition-colors">
                     HoldMeToIt
                  </span>
               </Link>

               <Link
                  href="/challenges"
                  className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3"
               >
                  Challenges
               </Link>

               <Link
                  href="/wallet"
                  data-testid="wallet-nav-link"
                  className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3 flex items-center gap-1.5"
               >
                  <CoinsIcon className="h-3.5 w-3.5 text-economy-gold" />
                  <span>Wallet</span>
               </Link>

               <Link
                  href="/leaderboard"
                  data-testid="trophy-leaderboard-nav-link"
                  className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3 flex items-center gap-1.5"
               >
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Leaderboard</span>
               </Link>

               <Link
                  href="/pokemon"
                  data-testid="pokemon-nav-link"
                  className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3 flex items-center gap-1.5"
               >
                  <BookOpen className="h-3.5 w-3.5 text-rose-400" />
                  <span>Pokédex</span>
               </Link>

               {isDevRole(effectiveUser?.role) && (
                  <Link
                     href="/devboard"
                     data-testid="devboard-nav-link"
                     className="text-xs sm:text-sm font-medium text-[#868686] hover:text-[#f4f3f6] transition-colors border-l border-[#292929] pl-2 sm:pl-3"
                  >
                     DevBoard
                  </Link>
               )}

               {resolvedIsActualAdmin && !previewActive && (
                  <Link
                     href="/admin"
                     data-testid="admin-nav-link"
                     className="text-xs sm:text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors border-l border-[#292929] pl-2 sm:pl-3"
                  >
                     Admin
                  </Link>
               )}
            </div>

            <UserNav
               user={effectiveUser}
               redirectTo="/"
               isActualAdmin={resolvedIsActualAdmin}
               isPreviewActive={previewActive}
            />
         </div>
      </header>
   );
}
