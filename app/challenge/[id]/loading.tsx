/** Renders the challenge scoreboard loading skeleton. */
export default function ChallengeLoading() {
   return (
      <div className="space-y-8 animate-pulse" aria-label="Loading scoreboard">
         {/* Match Banner Skeleton */}
         <div className="h-72 rounded-3xl border border-[#262626] bg-[#141414]" />

         {/* Standings Table Skeleton */}
         <div className="space-y-4 rounded-3xl border border-[#262626] bg-[#141414] p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
               <div className="h-6 w-48 rounded-lg bg-[#1c1c1c]" />
               <div className="h-8 w-32 rounded-lg bg-[#1c1c1c]" />
            </div>
            <div className="space-y-3 pt-2">
               {Array.from({ length: 5 }).map((_, i) => (
                  <div
                     key={i}
                     className="h-12 w-full rounded-xl bg-[#1c1c1c]/50"
                  />
               ))}
            </div>
         </div>

         {/* Punishment Wall Skeleton */}
         <div className="h-44 rounded-3xl border border-[#262626] bg-[#141414] p-6" />
      </div>
   );
}
