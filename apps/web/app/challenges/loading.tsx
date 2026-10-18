/** Renders the challenges directory loading skeleton. */
export default function ChallengesLoading() {
   return (
      <div className="space-y-8 max-w-6xl mx-auto animate-pulse">
         {/* Back Link Skeleton */}
         <div className="h-5 w-16 rounded bg-surface-elevated" />

         {/* Events Title Skeleton */}
         <div className="pt-2">
            <div className="h-8 w-28 rounded bg-surface-elevated" />
         </div>

         {/* 3-Column Card Grid Skeleton */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
               <div
                  key={i}
                  className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden flex flex-col justify-between"
               >
                  {/* Thumbnail skeleton */}
                  <div className="h-44 w-full bg-surface-elevated" />
                  {/* Content skeleton */}
                  <div className="p-5 space-y-4">
                     <div className="h-5 w-3/4 rounded bg-surface-nested" />
                     <div className="flex gap-2">
                        <div className="h-5 w-12 rounded-full bg-surface-nested" />
                        <div className="h-5 w-16 rounded-full bg-surface-nested" />
                        <div className="h-5 w-20 rounded-full bg-surface-nested" />
                     </div>
                     <div className="pt-2">
                        <div className="h-9 w-full rounded-xl bg-surface-nested" />
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
}
