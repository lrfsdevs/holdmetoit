/** Renders the DevBoard loading skeleton. */
export default function DevBoardLoading() {
   return (
      <div className="space-y-8 animate-pulse">
         {/* Header Skeleton */}
         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="space-y-2">
                  <div className="h-8 w-44 rounded-xl bg-surface-elevated" />
                  <div className="h-4 w-72 rounded-lg bg-surface-secondary" />
               </div>
               <div className="h-10 w-40 rounded-xl bg-surface-elevated" />
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
               {[1, 2, 3, 4].map((i) => (
                  <div
                     key={i}
                     className="h-20 rounded-xl border border-border-subtle bg-surface-primary p-4"
                  />
               ))}
            </div>

            {/* Search bar */}
            <div className="h-10 rounded-xl bg-surface-primary border border-border-subtle" />
         </div>

         {/* Cards Skeleton */}
         <div className="space-y-4">
            {[1, 2, 3].map((i) => (
               <div
                  key={i}
                  className="h-36 rounded-xl border border-border-subtle bg-surface-primary p-5"
               />
            ))}
         </div>
      </div>
   );
}
