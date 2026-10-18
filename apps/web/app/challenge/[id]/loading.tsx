/** Renders the challenge scoreboard loading skeleton. */
export default function ChallengeLoading() {
   return (
      <div className="space-y-8 animate-pulse" aria-label="Loading scoreboard">
         {/* Match Banner Skeleton */}
         <div className="h-72 rounded-3xl border border-border-default bg-surface-primary" />

         {/* Standings Table Skeleton */}
         <div className="space-y-4 rounded-3xl border border-border-default bg-surface-primary p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
               <div className="h-6 w-48 rounded-lg bg-surface-elevated" />
               <div className="h-8 w-32 rounded-lg bg-surface-elevated" />
            </div>
            <div className="space-y-3 pt-2">
               {Array.from({ length: 5 }).map((_, i) => (
                  <div
                     key={i}
                     className="h-12 w-full rounded-xl bg-surface-elevated/50"
                  />
               ))}
            </div>
         </div>

         {/* Punishment Wall Skeleton */}
         <div className="h-44 rounded-3xl border border-border-default bg-surface-primary p-6" />
      </div>
   );
}
