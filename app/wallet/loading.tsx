/** Renders the Wallet loading skeleton (Law L9). */
export default function WalletLoading() {
   return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6]">
         <div className="h-16 border-b border-[#1f1f1f] bg-[#0d0d0d]" />
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-pulse">
            {/* Header Skeleton */}
            <div className="h-10 w-48 rounded-xl bg-[#1c1c1c]" />

            {/* Wallet Summary Card Skeleton */}
            <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-5">
               <div className="flex justify-between items-center">
                  <div className="h-6 w-36 rounded-lg bg-[#1c1c1c]" />
                  <div className="h-8 w-28 rounded-full bg-[#1c1c1c]" />
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                     <div key={i} className="h-24 rounded-xl bg-[#181818]" />
                  ))}
               </div>
               <div className="h-12 rounded-xl bg-[#181818]" />
            </div>

            {/* Transaction History Skeleton */}
            <div className="rounded-2xl border border-[#292929] bg-[#141414] p-6 space-y-4">
               <div className="h-6 w-44 rounded-lg bg-[#1c1c1c]" />
               <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                     <div key={i} className="h-14 rounded-xl bg-[#181818]" />
                  ))}
               </div>
            </div>
         </main>
      </div>
   );
}
