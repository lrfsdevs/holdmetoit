import Image from "next/image";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RefreshAvatarButton } from "@/features/auth/presentation/refresh-avatar-button";
import Link from "next/link";
import {
   ChevronRight,
   Crown,
   Shield,
   User as UserIcon,
   Clock,
} from "lucide-react";
import type { ParticipantProfileHeader as ProfileHeaderType } from "../domain/participant-stats.types";
import { getTeamBadgeStyle } from "@/features/challenges/domain/team-colors";

interface ParticipantProfileHeaderProps {
   profile: ProfileHeaderType;
   isAdmin?: boolean;
   isOwner?: boolean;
   viewParam?: string;
   isFallback?: boolean;
}

export function ParticipantProfileHeader({
   profile,
   isAdmin = false,
   isOwner = false,
   viewParam,
   isFallback = false,
}: ParticipantProfileHeaderProps) {
   const isRankOne = !isFallback && profile.rank === 1;

   const paceColors = {
      serene:
         "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text",
      "on-track":
         "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text",
      "catch-up": "bg-brand-1/15 border-brand-1/40 text-brand-1",
      punished:
         "bg-feedback-error-bg border-feedback-error/40 text-feedback-error-text",
      excused: "bg-accent-bg border-accent/40 text-accent-text",
   };

   const paceClass =
      paceColors[profile.paceStatus] ||
      "bg-surface-elevated border-border-strong text-text-secondary";

   const leaderboardUrl = `/challenge/${profile.challengeId}?tab=leaderboard${
      viewParam ? `&view=${encodeURIComponent(viewParam)}` : ""
   }`;

   return (
      <div className="space-y-4">
         {/* Breadcrumb Navigation */}
         <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-text-tertiary flex-wrap"
         >
            <Link
               href="/challenges"
               className="hover:text-white transition-colors"
            >
               Challenges
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <Link
               href={`/challenge/${profile.challengeId}`}
               className="hover:text-white transition-colors truncate max-w-[150px] sm:max-w-artwork-sm"
            >
               {profile.challengeTitle}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <Link
               href={leaderboardUrl}
               className="hover:text-white transition-colors"
            >
               Leaderboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <span className="text-text-primary font-medium truncate max-w-[150px] sm:max-w-artwork-sm">
               {profile.displayName}
            </span>
         </nav>

         {/* Main Profile Header Card */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
               {/* Left: Avatar & Identity Details */}
               <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                     <UserAvatar
                        src={profile.image}
                        name={profile.displayName}
                        userId={profile.userId}
                        size="xl"
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-border-strong shadow-md text-xl"
                     />
                     {isRankOne && (
                        <div
                           className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-feedback-success text-text-inverse flex items-center justify-center shadow-lg border border-black/40"
                           title="Rank 1 MVP"
                        >
                           <Crown className="h-4 w-4 fill-current" />
                        </div>
                     )}
                  </div>

                  {/* Names & Badges */}
                  <div className="min-w-0 space-y-1.5">
                     <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight truncate">
                           {profile.displayName}
                        </h1>

                        {/* Team Badge */}
                        {profile.teamName && (
                           <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                              style={getTeamBadgeStyle(profile.teamColor)}
                           >
                              <span>{profile.teamIcon || "🛡️"}</span>
                              <span>{profile.teamName}</span>
                           </span>
                        )}

                        {/* Pace Status Badge */}
                        <span
                           className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              isFallback
                                 ? "bg-surface-elevated border-border-strong text-text-tertiary"
                                 : paceClass
                           }`}
                        >
                           {isFallback ? "Not Enrolled" : profile.paceLabel}
                        </span>
                     </div>

                     {profile.username && (
                        <p className="text-xs text-text-tertiary">
                           @{profile.username}
                        </p>
                     )}

                     <p className="text-xs text-text-tertiary flex items-center gap-1 pt-0.5">
                        <Shield className="h-3.5 w-3.5 text-text-tertiary" />
                        <span>
                           {isFallback ? "Spectating in " : "Competing in "}
                           <Link
                              href={`/challenge/${profile.challengeId}`}
                              className="text-text-primary font-medium hover:underline"
                           >
                              {profile.challengeTitle}
                           </Link>
                        </span>
                     </p>
                  </div>
               </div>

               {/* Right: Challenge Ranking Badge & Admin Link */}
               <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-border-default">
                  <div className="flex items-center gap-2">
                     <span className="text-xs text-text-tertiary">
                        Leaderboard Rank
                     </span>
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-elevated border border-border-strong text-sm font-extrabold text-white font-sans">
                        {isFallback || profile.rank === 0 ? (
                           <span className="text-xs font-medium text-text-tertiary">
                              Unranked
                           </span>
                        ) : (
                           <>
                              <span
                                 className={
                                    isRankOne
                                       ? "text-feedback-success"
                                       : "text-text-primary"
                                 }
                              >
                                 #{profile.rank}
                              </span>
                              <span className="text-xs text-text-tertiary font-normal">
                                 / {profile.totalParticipants}
                              </span>
                           </>
                        )}
                     </div>
                  </div>

                  {isOwner && (
                     <RefreshAvatarButton
                        userId={profile.userId}
                        size="sm"
                        className="rounded-xl border-border-strong bg-surface-nested hover:bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-white"
                     />
                  )}

                  {isAdmin && !isFallback && (
                     <Link
                        href={`/challenge/${profile.challengeId}?tab=manage`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-nested hover:bg-surface-nested border border-border-strong text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                        title="Manage participant in challenge admin tab"
                     >
                        <Clock className="h-3.5 w-3.5 text-feedback-info" />
                        <span>Admin Controls</span>
                     </Link>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
