export default function NewChallengeLoading() {
   return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
         {/* Header skeleton */}
         <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1f1f1f]" />
            <div className="space-y-2">
               <div className="h-7 w-52 rounded-lg bg-[#1f1f1f]" />
               <div className="h-4 w-72 rounded bg-[#1a1a1a]" />
            </div>
         </div>

         {/* Step indicator skeleton */}
         <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-full bg-[#1c1c1c]" />
            <div className="h-8 w-28 rounded-full bg-[#1c1c1c]" />
            <div className="h-8 w-24 rounded-full bg-[#1c1c1c]" />
         </div>

         {/* Form card skeleton */}
         <div className="rounded-3xl border border-[#262626] bg-[#141414] p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
               <div className="h-4 w-32 rounded bg-[#262626]" />
               <div className="h-11 w-full rounded-xl bg-[#1c1c1c]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-[#262626]" />
                  <div className="h-11 w-full rounded-xl bg-[#1c1c1c]" />
               </div>
               <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-[#262626]" />
                  <div className="h-11 w-full rounded-xl bg-[#1c1c1c]" />
               </div>
            </div>

            <div className="space-y-2">
               <div className="h-4 w-40 rounded bg-[#262626]" />
               <div className="h-36 w-full rounded-2xl bg-[#1c1c1c]" />
            </div>

            <div className="flex justify-end gap-3 pt-4">
               <div className="h-11 w-28 rounded-xl bg-[#262626]" />
               <div className="h-11 w-32 rounded-xl bg-[#ffffff]/20" />
            </div>
         </div>
      </div>
   );
}
