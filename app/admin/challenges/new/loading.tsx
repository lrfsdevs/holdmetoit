/** Renders the loading skeleton for the challenge creator wizard. */
export default function NewChallengeLoading() {
   return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
         {/* Header skeleton */}
         <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-obsidian-elevated" />
            <div className="space-y-2">
               <div className="h-7 w-52 rounded-lg bg-obsidian-elevated" />
               <div className="h-4 w-72 rounded bg-obsidian-cardHover" />
            </div>
         </div>

         {/* Step indicator skeleton */}
         <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-full bg-obsidian-elevated" />
            <div className="h-8 w-28 rounded-full bg-obsidian-elevated" />
            <div className="h-8 w-24 rounded-full bg-obsidian-elevated" />
         </div>

         {/* Form card skeleton */}
         <div className="rounded-3xl border border-obsidian-borderSubtle bg-obsidian-card p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
               <div className="h-4 w-32 rounded bg-obsidian-borderSubtle" />
               <div className="h-11 w-full rounded-xl bg-obsidian-elevated" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-obsidian-borderSubtle" />
                  <div className="h-11 w-full rounded-xl bg-obsidian-elevated" />
               </div>
               <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-obsidian-borderSubtle" />
                  <div className="h-11 w-full rounded-xl bg-obsidian-elevated" />
               </div>
            </div>

            <div className="space-y-2">
               <div className="h-4 w-40 rounded bg-obsidian-borderSubtle" />
               <div className="h-36 w-full rounded-2xl bg-obsidian-elevated" />
            </div>

            <div className="flex justify-end gap-3 pt-4">
               <div className="h-11 w-28 rounded-xl bg-obsidian-borderSubtle" />
               <div className="h-11 w-32 rounded-xl bg-obsidian-text/20" />
            </div>
         </div>
      </div>
   );
}
