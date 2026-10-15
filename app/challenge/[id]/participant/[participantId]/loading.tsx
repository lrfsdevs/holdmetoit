/** Renders the participant statistics loading skeleton. */
export default function ParticipantStatsLoading() {
   return (
      <div
         className="space-y-8 max-w-6xl mx-auto pb-12 animate-pulse"
         aria-label="Loading participant statistics"
      >
         {/* Breadcrumb Skeleton */}
         <div className="h-4 w-64 rounded bg-[#1c1c1c]" />

         {/* Profile Header Skeleton */}
         <div className="h-36 rounded-3xl border border-[#262626] bg-[#141414] p-6 flex items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-[#1c1c1c] shrink-0" />
            <div className="space-y-2 flex-1">
               <div className="h-6 w-48 rounded bg-[#1c1c1c]" />
               <div className="h-4 w-32 rounded bg-[#1c1c1c]" />
            </div>
         </div>

         {/* Summary Cards Skeleton */}
         <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
               <div
                  key={i}
                  className="h-28 rounded-2xl border border-[#262626] bg-[#141414] p-5 space-y-3"
               >
                  <div className="h-4 w-24 rounded bg-[#1c1c1c]" />
                  <div className="h-7 w-32 rounded bg-[#1c1c1c]" />
               </div>
            ))}
         </div>

         {/* Progress Chart Skeleton */}
         <div className="h-64 rounded-3xl border border-[#262626] bg-[#141414] p-6 space-y-4">
            <div className="h-6 w-44 rounded bg-[#1c1c1c]" />
            <div className="h-44 w-full rounded bg-[#1c1c1c]/40" />
         </div>

         {/* Daily History Table Skeleton */}
         <div className="h-72 rounded-3xl border border-[#262626] bg-[#141414] p-6 space-y-4">
            <div className="h-6 w-48 rounded bg-[#1c1c1c]" />
            <div className="space-y-2 pt-2">
               {Array.from({ length: 4 }).map((_, i) => (
                  <div
                     key={i}
                     className="h-10 w-full rounded-xl bg-[#1c1c1c]/50"
                  />
               ))}
            </div>
         </div>
      </div>
   );
}
