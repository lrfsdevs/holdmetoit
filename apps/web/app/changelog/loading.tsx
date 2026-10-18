export default function ChangelogLoading() {
   return (
      <div className="mx-auto max-w-3xl space-y-8 animate-pulse">
         <div className="space-y-2">
            <div className="h-8 w-32 rounded bg-surface-elevated" />
            <div className="h-4 w-64 rounded bg-surface-elevated" />
         </div>

         <div className="space-y-8">
            {[1, 2, 3].map((group) => (
               <div key={group} className="space-y-3">
                  <div className="h-4 w-36 rounded bg-surface-elevated" />
                  <div className="space-y-4">
                     <div className="rounded-2xl border border-border-default bg-surface-primary p-5 space-y-3">
                        <div className="h-5 w-2/3 rounded bg-surface-nested" />
                        <div className="h-4 w-full rounded bg-surface-nested" />
                        <div className="h-4 w-4/5 rounded bg-surface-nested" />
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
}
