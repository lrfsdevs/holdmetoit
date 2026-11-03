"use client";

import { useState } from "react";
import { History, Sparkles, Wrench, Layers } from "lucide-react";

import { EmptyState } from "@/components/state/empty-state";
import {
   countAudienceEntries,
   formatEntryDate,
   selectVisibleGroups,
   type ChangelogAudienceFilter,
   type ChangelogGroup,
} from "@/features/changelog/domain/changelog";

export function ChangelogView({
   groups,
   isAdmin,
}: {
   groups: readonly ChangelogGroup[];
   isAdmin: boolean;
}) {
   const [filter, setFilter] = useState<ChangelogAudienceFilter>("all");

   const counts = countAudienceEntries(groups);
   const orderedGroups = selectVisibleGroups(groups, isAdmin, filter);

   return (
      <div className="mx-auto max-w-3xl space-y-8">
         <header className="space-y-4">
            <div>
               <h1 className="border-b-2 border-white pb-1.5 font-display text-2xl font-extrabold tracking-tight text-text-primary">
                  Changelog
               </h1>
               <p className="mt-2 text-sm text-text-tertiary">
                  Product updates and improvements, newest first.
               </p>
            </div>

            {isAdmin ? (
               <div className="space-y-3 rounded-xl border border-brand-2/30 bg-brand-2/5 p-3 sm:p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                     <p className="text-xs font-medium text-brand-2">
                        Admin view — Internal engineering & host updates are
                        included.
                     </p>
                     <span className="text-label text-text-tertiary">
                        {counts.user} user-facing · {counts.internal} admin/dev
                     </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                     <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-medium transition-colors ${
                           filter === "all"
                              ? "bg-surface-elevated text-text-primary shadow-sm border border-border-focus"
                              : "text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary"
                        }`}
                     >
                        <Layers className="h-3 w-3" aria-hidden="true" />
                        All Updates ({counts.total})
                     </button>
                     <button
                        type="button"
                        onClick={() => setFilter("user")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-medium transition-colors ${
                           filter === "user"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary"
                        }`}
                     >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        User Facing ({counts.user})
                     </button>
                     <button
                        type="button"
                        onClick={() => setFilter("internal")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-medium transition-colors ${
                           filter === "internal"
                              ? "bg-surface-elevated text-brand-2 border border-brand-2/50"
                              : "text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary"
                        }`}
                     >
                        <Wrench className="h-3 w-3" aria-hidden="true" />
                        Admin & Dev ({counts.internal})
                     </button>
                  </div>
               </div>
            ) : null}
         </header>

         {orderedGroups.length === 0 ? (
            <div className="mx-auto max-w-3xl">
               <EmptyState
                  title="No updates yet"
                  description="Product updates will appear here as they ship. Check back soon."
               />
            </div>
         ) : (
            <div className="space-y-8">
               {orderedGroups.map((group) => (
                  <section key={group.date} className="space-y-3">
                     <div className="flex items-center gap-2">
                        <History
                           className="h-4 w-4 shrink-0 text-text-tertiary"
                           aria-hidden="true"
                        />
                        <h2 className="font-display text-sm font-semibold text-text-primary font-sans-tabular">
                           {formatEntryDate(group.date)}
                        </h2>
                     </div>

                     <div className="space-y-4">
                        {group.entries.map((entry) => (
                           <article
                              key={`${group.date}-${entry.title}`}
                              className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg transition-colors"
                           >
                              <div className="flex flex-wrap items-center gap-2">
                                 <h3 className="text-base font-semibold text-text-primary">
                                    {entry.title}
                                 </h3>
                                 {isAdmin ? (
                                    entry.audience === "user" ? (
                                       <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-label font-semibold uppercase tracking-wider text-emerald-400">
                                          User
                                       </span>
                                    ) : (
                                       <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-elevated px-2 py-0.5 text-label font-semibold uppercase tracking-wider text-text-tertiary">
                                          Admin / Dev
                                       </span>
                                    )
                                 ) : null}
                              </div>
                              {entry.body ? (
                                 <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                                    {entry.body}
                                 </p>
                              ) : null}
                              {entry.highlights &&
                              entry.highlights.length > 0 ? (
                                 <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary marker:text-text-tertiary">
                                    {entry.highlights.map((highlight) => (
                                       <li key={highlight}>{highlight}</li>
                                    ))}
                                 </ul>
                              ) : null}
                           </article>
                        ))}
                     </div>
                  </section>
               ))}
            </div>
         )}
      </div>
   );
}
