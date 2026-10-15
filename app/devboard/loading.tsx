export default function DevBoardLoading() {
   return (
      <div className="space-y-8 animate-pulse">
         {/* Header Skeleton */}
         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="space-y-2">
                  <div className="h-8 w-44 rounded-xl bg-[#1c1c1c]" />
                  <div className="h-4 w-72 rounded-lg bg-[#181818]" />
               </div>
               <div className="h-10 w-40 rounded-xl bg-[#1c1c1c]" />
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
               {[1, 2, 3, 4].map((i) => (
                  <div
                     key={i}
                     className="h-20 rounded-xl border border-[#222222] bg-[#141414] p-4"
                  />
               ))}
            </div>

            {/* Search bar */}
            <div className="h-10 rounded-xl bg-[#141414] border border-[#222222]" />
         </div>

         {/* Cards Skeleton */}
         <div className="space-y-4">
            {[1, 2, 3].map((i) => (
               <div
                  key={i}
                  className="h-36 rounded-xl border border-[#222222] bg-[#141414] p-5"
               />
            ))}
         </div>
      </div>
   );
}
