/** Renders the loading skeleton for the participant cockpit. */
export function CockpitSkeleton() {
   return (
      <div
         className="animate-pulse space-y-6 max-w-4xl mx-auto px-4 py-8 sm:py-12"
         aria-busy="true"
         aria-label="Loading"
      >
         <div className="h-8 w-48 rounded-lg bg-surface-elevated" />
         <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-96 rounded-3xl bg-surface-primary border border-border-default lg:col-span-5" />
            <div className="h-96 rounded-3xl bg-surface-primary border border-border-default lg:col-span-7" />
         </div>
      </div>
   );
}
