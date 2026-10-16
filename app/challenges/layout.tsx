/** Provides shared layout chrome for the challenge directory. */
export default function ChallengesLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0d0d0d] text-[#f4f3f6]">
         {/* Main Page Canvas */}
         <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
         </main>
      </div>
   );
}
