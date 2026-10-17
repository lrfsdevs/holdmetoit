export default function ProfileLoading() {
   return (
      <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-md flex-col items-center justify-center p-4">
         <div
            className="w-full rounded-3xl border border-[#262626] bg-[#141414] p-8 text-center shadow-lg animate-pulse"
            role="status"
            aria-label="Resolving participant profile"
         >
            <div className="mx-auto h-12 w-12 rounded-full border-2 border-[#22c55e]/30 border-t-[#22c55e] animate-spin" />
            <h2 className="mt-4 text-base font-semibold text-[#ffffff]">
               Locating your profile...
            </h2>
            <p className="mt-2 text-xs text-[#868686]">
               Connecting you to your active challenge dashboard.
            </p>
         </div>
      </main>
   );
}
