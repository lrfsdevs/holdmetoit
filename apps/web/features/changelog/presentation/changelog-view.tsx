import { History } from "lucide-react";

import { EmptyState } from "@/components/state/empty-state";
import {
   formatEntryDate,
   selectVisibleGroups,
   type ChangelogGroup,
} from "@/features/changelog/domain/changelog";

export function ChangelogView({
   groups,
   isAdmin,
}: {
   groups: readonly ChangelogGroup[];
   isAdmin: boolean;
}) {
   const orderedGroups = selectVisibleGroups(groups, isAdmin);

   if (orderedGroups.length === 0) {
      return (
         <div className="mx-auto max-w-3xl">
            <EmptyState
               title="No updates yet"
               description="Product updates will appear here as they ship. Check back soon."
            />
         </div>
      );
   }

   return (
      <div className="mx-auto max-w-3xl space-y-8">
         <header className="space-y-2">
            <h1 className="border-b-2 border-white pb-1.5 font-display text-2xl font-extrabold tracking-tight text-[#f4f3f6]">
               Changelog
            </h1>
            <p className="text-sm text-[#868686]">
               Product updates and improvements, newest first.
            </p>
            {isAdmin ? (
               <p className="text-xs text-[#e08a32]">
                  Admin view — internal engineering entries are included.
               </p>
            ) : null}
         </header>

         <div className="space-y-8">
            {orderedGroups.map((group) => (
               <section key={group.date} className="space-y-3">
                  <div className="flex items-center gap-2">
                     <History
                        className="h-4 w-4 shrink-0 text-[#868686]"
                        aria-hidden="true"
                     />
                     <h2 className="font-display text-sm font-semibold text-[#f4f3f6] font-sans-tabular">
                        {formatEntryDate(group.date)}
                     </h2>
                  </div>

                  <div className="space-y-4">
                     {group.entries.map((entry) => (
                        <article
                           key={`${group.date}-${entry.title}`}
                           className="rounded-2xl border border-[#262626] bg-[#141414] p-5 shadow-lg"
                        >
                           <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-[#f4f3f6]">
                                 {entry.title}
                              </h3>
                              {entry.audience === "internal" ? (
                                 <span className="inline-flex items-center rounded-full border border-[#434343] bg-[#1c1c1c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#868686]">
                                    Internal
                                 </span>
                              ) : null}
                           </div>
                           {entry.body ? (
                              <p className="mt-2 text-sm leading-relaxed text-[#d1d1d1]">
                                 {entry.body}
                              </p>
                           ) : null}
                           {entry.highlights && entry.highlights.length > 0 ? (
                              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#d1d1d1] marker:text-[#868686]">
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
      </div>
   );
}
