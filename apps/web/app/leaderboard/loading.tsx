/** Renders the Trophy Leaderboard loading skeleton (Law L9). */
export default function LeaderboardLoading() {
   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-8 space-y-6 animate-pulse">
            {/* Hero Header Skeleton */}
            <div className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-8 space-y-4">
               <div className="h-6 w-44 rounded-full bg-surface-elevated" />
               <div className="h-8 w-72 rounded-xl bg-surface-elevated" />
               <div className="h-4 w-full max-w-lg rounded-lg bg-surface-secondary" />
            </div>

            {/* Search & Sort Controls Skeleton */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
               <div className="h-10 w-full sm:w-72 rounded-xl bg-surface-secondary" />
               <div className="flex gap-2 w-full sm:w-auto">
                  <div className="h-9 w-24 rounded-xl bg-surface-secondary" />
                  <div className="h-9 w-24 rounded-xl bg-surface-secondary" />
               </div>
            </div>

            {/* Leaderboard Table Skeleton */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4 sm:p-6 space-y-3">
               <div className="h-8 w-full rounded-lg bg-surface-elevated" />
               {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                     key={i}
                     className="h-14 w-full rounded-xl bg-surface-secondary"
                  />
               ))}
            </div>
         </main>
      </div>
   );
}
