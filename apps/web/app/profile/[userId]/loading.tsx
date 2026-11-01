export default function UserProfileLoading() {
   return (
      <main className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 py-8 animate-pulse">
         {/* Profile Header Skeleton */}
         <div className="rounded-3xl border border-border-default bg-surface-primary p-6 sm:p-8 flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-surface-elevated" />
            <div className="space-y-2.5 flex-1">
               <div className="h-6 w-48 rounded-lg bg-surface-elevated" />
               <div className="h-4 w-32 rounded-lg bg-surface-elevated" />
               <div className="h-3 w-40 rounded-lg bg-surface-elevated" />
            </div>
         </div>

         {/* Tabs Bar Skeleton */}
         <div className="flex gap-2 border-b border-border-default pb-2">
            <div className="h-9 w-24 rounded-xl bg-surface-elevated" />
            <div className="h-9 w-36 rounded-xl bg-surface-elevated" />
         </div>

         {/* Career Cards Grid Skeleton */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
               <div
                  key={i}
                  className="h-28 rounded-2xl border border-border-default bg-surface-primary"
               />
            ))}
         </div>
      </main>
   );
}
