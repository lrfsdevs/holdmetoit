import Image from "next/image";
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
import { TrophyRoleBadge } from "@/features/trophies/presentation/trophy-role-badge";

interface ParticipantProfileHeaderProps {
   profile: ProfileHeaderType;
   isAdmin?: boolean;
   viewParam?: string;
}

export function ParticipantProfileHeader({
   profile,
   isAdmin = false,
   viewParam,
}: ParticipantProfileHeaderProps) {
   const isRankOne = profile.rank === 1;

   const paceColors = {
      serene: "bg-[#144520] border-[#22c55e]/40 text-[#85ff93]",
      "on-track": "bg-[#144520] border-[#22c55e]/40 text-[#85ff93]",
      "catch-up": "bg-[#402010] border-[#f59e0b]/40 text-[#fcd34d]",
      punished: "bg-[#401010] border-[#ef4444]/40 text-[#ff8080]",
      excused: "bg-[#230e40] border-[#8b5cf6]/40 text-[#c4b5fd]",
   };

   const paceClass =
      paceColors[profile.paceStatus] ||
      "bg-[#1c1c1c] border-[#383838] text-[#d1d1d1]";

   const leaderboardUrl = `/challenge/${profile.challengeId}?tab=leaderboard${
      viewParam ? `&view=${encodeURIComponent(viewParam)}` : ""
   }`;

   return (
      <div className="space-y-4">
         {/* Breadcrumb Navigation */}
         <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-[#868686] flex-wrap"
         >
            <Link
               href="/challenges"
               className="hover:text-white transition-colors"
            >
               Challenges
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#434343]" />
            <Link
               href={`/challenge/${profile.challengeId}`}
               className="hover:text-white transition-colors truncate max-w-[150px] sm:max-w-[200px]"
            >
               {profile.challengeTitle}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#434343]" />
            <Link
               href={leaderboardUrl}
               className="hover:text-white transition-colors"
            >
               Leaderboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#434343]" />
            <span className="text-[#f4f3f6] font-medium truncate max-w-[150px] sm:max-w-[200px]">
               {profile.displayName}
            </span>
         </nav>

         {/* Main Profile Header Card */}
         <div className="rounded-3xl border border-[#262626] bg-[#141414] p-5 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
               {/* Left: Avatar & Identity Details */}
               <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                     <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-[#1c1c1c] border-2 border-[#383838] overflow-hidden flex items-center justify-center text-xl font-bold text-white shadow-md">
                        {profile.image ? (
                           <Image
                              src={profile.image}
                              alt={profile.displayName}
                              width={80}
                              height={80}
                              className="h-full w-full object-cover"
                              unoptimized
                           />
                        ) : (
                           <UserIcon className="h-8 w-8 text-[#868686]" />
                        )}
                     </div>
                     {isRankOne && (
                        <div
                           className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-[#22c55e] text-[#0d0d0d] flex items-center justify-center shadow-lg border border-black/40"
                           title="Rank 1 MVP"
                        >
                           <Crown className="h-4 w-4 fill-current" />
                        </div>
                     )}
                  </div>

                  {/* Names & Badges */}
                  <div className="min-w-0 space-y-1.5">
                     <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-[#f4f3f6] tracking-tight truncate">
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

                        {/* Trophy Rank Role Badge */}
                        {typeof profile.trophies === "number" && (
                           <TrophyRoleBadge
                              trophies={profile.trophies}
                              size="sm"
                           />
                        )}

                        {/* Pace Status Badge */}
                        <span
                           className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${paceClass}`}
                        >
                           {profile.paceLabel}
                        </span>
                     </div>

                     {profile.username && (
                        <p className="text-xs text-[#868686]">
                           @{profile.username}
                        </p>
                     )}

                     <p className="text-xs text-[#a3a3a3] flex items-center gap-1 pt-0.5">
                        <Shield className="h-3.5 w-3.5 text-[#868686]" />
                        <span>
                           Competing in{" "}
                           <Link
                              href={`/challenge/${profile.challengeId}`}
                              className="text-[#f4f3f6] font-medium hover:underline"
                           >
                              {profile.challengeTitle}
                           </Link>
                        </span>
                     </p>
                  </div>
               </div>

               {/* Right: Challenge Ranking Badge & Admin Link */}
               <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#262626]">
                  <div className="flex items-center gap-2">
                     <span className="text-xs text-[#868686]">
                        Leaderboard Rank
                     </span>
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1c1c1c] border border-[#383838] text-sm font-extrabold text-[#ffffff] font-sans">
                        <span
                           className={
                              isRankOne ? "text-[#22c55e]" : "text-[#f4f3f6]"
                           }
                        >
                           #{profile.rank}
                        </span>
                        <span className="text-xs text-[#868686] font-normal">
                           / {profile.totalParticipants}
                        </span>
                     </div>
                  </div>

                  {isAdmin && (
                     <Link
                        href={`/challenge/${profile.challengeId}?tab=manage`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#333333] border border-[#383838] text-xs font-semibold text-[#d1d1d1] hover:text-white transition-colors"
                        title="Manage participant in challenge admin tab"
                     >
                        <Clock className="h-3.5 w-3.5 text-[#3b82f6]" />
                        <span>Admin Controls</span>
                     </Link>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
