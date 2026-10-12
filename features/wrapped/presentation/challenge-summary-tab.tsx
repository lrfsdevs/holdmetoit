"use client";

import { EmptyState } from "@/components/state/empty-state";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/data/leaderboard-data";
import { getTeamColorPalette } from "@/features/challenges/domain/team-colors";
import { Trophy } from "lucide-react";
import { buildChallengeWrappedViewModel } from "../domain/wrapped";

interface ChallengeSummaryTabProps {
   challenge: ChallengeScoreboardViewModel;
}

function formatPeriod(startAt: string, endAt: string): string {
   const start = new Date(startAt);
   const end = new Date(endAt);
   const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
   });

   return `${formatter.format(start)} – ${formatter.format(end)}, ${end.getUTCFullYear()}`;
}

/**
 * Post-lock "Summary" tab: the wrapped in page format. Spectators get the
 * challenge-level story; enrolled participants also get their personal block.
 */
export function ChallengeSummaryTab({ challenge }: ChallengeSummaryTabProps) {
   const wrapped = buildChallengeWrappedViewModel(
      challenge,
      challenge.currentUser.participantId
   );

   if (wrapped.participantsCount === 0) {
      return (
         <EmptyState
            title="No wrapped data yet"
            description="Once participants start logging study time, the challenge wrapped will appear here after the host locks the results."
         />
      );
   }

   const viewer = wrapped.viewer;
   const maxDaySeconds = viewer
      ? viewer.daily.reduce((max, day) => Math.max(max, day.durationSeconds), 0)
      : 0;

   const verdict =
      viewer?.verdict === "saved"
         ? {
              label: "Saved",
              className: "bg-[#144520] text-[#85ff93] border-[#22c55e]/40",
           }
         : viewer?.verdict === "excused"
           ? {
                label: "Excused",
                className: "bg-[#102d40] text-[#85d6ff] border-[#3b82f6]/40",
             }
           : {
                label: "Punished",
                className: "bg-[#401010] text-[#ff5757] border-[#ef4444]/40",
             };

   return (
      <div className="space-y-6">
         <section className="rounded-2xl border border-[#292929] bg-[#141414] p-5 sm:p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
               Challenge Wrapped
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold font-display text-[#f4f3f6] tracking-tight">
               {wrapped.title}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#868686]">
               {formatPeriod(wrapped.startAt, wrapped.endAt)} ·{" "}
               <span>
                  {wrapped.participantsCount}{" "}
                  {wrapped.participantsCount === 1
                     ? "participant"
                     : "participants"}
               </span>{" "}
               ·{" "}
               <span className="font-sans font-sans-tabular font-semibold text-[#f4f3f6]">
                  {wrapped.challengeTotalClock}
               </span>{" "}
               studied in total
            </p>
         </section>

         <section className="rounded-2xl border border-[#292929] bg-[#141414] p-5 sm:p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
               Final team results
            </h3>
            <ul className="mt-3 space-y-2">
               {wrapped.teams.map((team, index) => {
                  const teamPalette = getTeamColorPalette(team.color, index);
                  return (
                     <li
                        key={team.id}
                        className="flex items-center justify-between rounded-xl border border-[#292929] bg-[#1c1c1c] px-4 py-2.5 transition-colors"
                     >
                        <span className="flex items-center gap-2.5 text-sm font-semibold text-[#f4f3f6]">
                           <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: teamPalette.solid }}
                              aria-hidden="true"
                           />
                           {team.iconEmoji && (
                              <span aria-hidden="true">{team.iconEmoji}</span>
                           )}
                           <span>{team.name}</span>
                        </span>
                        <span className="flex items-center gap-3">
                           {team.isWinner && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-amber-300">
                                 <Trophy
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                 />
                                 Winner
                              </span>
                           )}
                           <span className="text-sm font-bold font-sans font-sans-tabular text-[#f4f3f6]">
                              {team.totalLoggedClock}
                           </span>
                        </span>
                     </li>
                  );
               })}
            </ul>
         </section>

         {viewer && (
            <>
               <section className="rounded-2xl border border-[#292929] bg-[#141414] p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                     <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Your wrapped
                        </h3>
                        <p className="mt-1 text-lg sm:text-xl font-bold font-sans text-[#f4f3f6]">
                           {viewer.displayName} ·{" "}
                           <span className="font-sans-tabular">
                              Rank #{viewer.rank}
                           </span>{" "}
                           of{" "}
                           <span className="font-sans-tabular">
                              {viewer.totalParticipants}
                           </span>
                        </p>
                     </div>
                     <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${verdict.className}`}
                     >
                        {verdict.label}
                     </span>
                  </div>

                  {viewer.verdict === "punished" &&
                     viewer.reasons.length > 0 && (
                        <p className="mt-3 text-xs sm:text-sm text-[#ff5757] font-medium leading-relaxed">
                           {viewer.reasons
                              .map((reason) =>
                                 reason === "hours_deficit"
                                    ? "missed target hours"
                                    : reason === "incomplete_weekly_tasks"
                                      ? "incomplete weekly tasks"
                                      : "team finished behind"
                              )
                              .join(" · ")}
                        </p>
                     )}

                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Time studied
                        </dt>
                        <dd className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                           {viewer.totalClock}
                        </dd>
                     </div>
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Declared target
                        </dt>
                        <dd className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                           {viewer.targetClock}
                        </dd>
                     </div>
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Best day
                        </dt>
                        <dd className="text-base sm:text-lg font-bold font-sans text-[#f4f3f6]">
                           {viewer.bestDay
                              ? `${viewer.bestDay.label} · ${viewer.bestDay.durationHuman}`
                              : "—"}
                        </dd>
                     </div>
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           vs average
                        </dt>
                        <dd className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                           {viewer.timesVsAverage !== null
                              ? `${viewer.timesVsAverage}×`
                              : "—"}
                        </dd>
                     </div>
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Team share
                        </dt>
                        <dd className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                           {viewer.contributionPercentage}%
                        </dd>
                     </div>
                     <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 sm:p-3.5 space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                           Weekly tasks
                        </dt>
                        <dd className="text-xl sm:text-2xl font-extrabold font-sans font-sans-tabular text-[#f4f3f6]">
                           {viewer.weeklyTasksCompletedCount}/
                           {viewer.weeklyTasksTotalCount}
                        </dd>
                     </div>
                  </dl>
               </section>

               <section className="rounded-2xl border border-[#292929] bg-[#141414] p-5 sm:p-6 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#868686]">
                     Study days
                  </h3>
                  <ul className="mt-3 space-y-2">
                     {viewer.daily.map((day) => (
                        <li
                           key={day.dateKey}
                           className="flex items-center gap-3 text-xs text-[#d1d1d1]"
                        >
                           <span className="w-16 shrink-0 font-sans text-xs font-medium text-[#868686]">
                              {day.label}
                           </span>
                           <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#292929]">
                              <span
                                 className="block h-full rounded-full bg-[#22c55e] transition-all duration-300"
                                 style={{
                                    width:
                                       maxDaySeconds > 0
                                          ? `${Math.round(
                                               (day.durationSeconds /
                                                  maxDaySeconds) *
                                                  100
                                            )}%`
                                          : "0%",
                                 }}
                              />
                           </span>
                           <span className="w-24 shrink-0 text-right font-sans font-sans-tabular text-xs font-bold text-[#f4f3f6]">
                              {day.durationHuman}
                           </span>
                        </li>
                     ))}
                  </ul>
               </section>
            </>
         )}

         {!viewer && (
            <section className="rounded-2xl border border-[#292929] bg-[#141414] p-5 sm:p-6 space-y-1">
               <h3 className="text-sm font-semibold text-[#f4f3f6]">
                  Personal Wrapped
               </h3>
               <p className="text-xs text-[#868686] leading-relaxed">
                  Sign in and join a challenge to unlock your personal wrapped
                  here after the host locks the results.
               </p>
            </section>
         )}
      </div>
   );
}
