/** Renders the Pokémon collection and catalogue loading skeleton (Law L9). */
export default function PokemonLoading() {
   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="mx-auto max-w-6xl px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-pulse">
            {/* Header & Collection Summary Skeleton */}
            <div className="rounded-2xl border border-border-default bg-surface-primary p-6 space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                     <div className="h-8 w-56 rounded-xl bg-surface-elevated" />
                     <div className="h-4 w-72 rounded-lg bg-surface-secondary" />
                  </div>
                  <div className="h-10 w-32 rounded-xl bg-surface-elevated" />
               </div>
               <div className="h-3 w-full rounded-full bg-surface-secondary" />
            </div>

            {/* Filter Bar Skeleton */}
            <div className="h-12 w-full rounded-2xl border border-border-default bg-surface-primary/60 p-2 flex items-center justify-between gap-3">
               <div className="flex gap-2">
                  <div className="h-8 w-24 rounded-lg bg-surface-elevated" />
                  <div className="h-8 w-24 rounded-lg bg-surface-secondary" />
               </div>
               <div className="h-8 w-48 rounded-lg bg-surface-secondary" />
            </div>

            {/* 12-Card Pokémon Grid Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
               {Array.from({ length: 12 }).map((_, i) => (
                  <div
                     key={i}
                     className="h-56 rounded-2xl bg-surface-secondary/60 border border-border-default"
                  />
               ))}
            </div>
         </main>
      </div>
   );
}
