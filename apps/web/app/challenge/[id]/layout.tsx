/** Provides shared layout chrome for a challenge. */
export default function ChallengeLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         {/* Main Page Canvas */}
         <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
         </main>
      </div>
   );
}
