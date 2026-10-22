import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Outfit } from "next/font/google";

import { AppHeader } from "@/components/ui/header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/core/auth";
import { LogRocketProvider } from "@/core/observability/logrocket-provider";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { FeedbackTriggerButton } from "@/features/feedback/presentation/feedback-trigger-button";
import { getFeatureFlags } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";

import "./globals.css";

const fontSans = Inter({
   subsets: ["latin"],
   variable: "--font-sans",
   display: "swap",
});

const fontDisplay = Outfit({
   subsets: ["latin"],
   variable: "--font-display",
   display: "swap",
});

export const metadata: Metadata = {
   title: "HoldMeToIt",
   description:
      "Gamified study accountability and challenge management for Discord communities.",
};

export default async function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive, effectiveRole } =
      getEffectiveAdminState({
         userRole: session?.user?.role,
         previewCookie,
      });

   const effectiveUser = session?.user
      ? { ...session.user, role: effectiveRole ?? session.user.role }
      : session?.user;

   const flags = await getFeatureFlags([
      FEATURE_FLAG_KEYS.pokemon,
      FEATURE_FLAG_KEYS.globalLeaderboard,
      FEATURE_FLAG_KEYS.logrocket,
   ]);

   return (
      <html
         lang="en"
         className={`dark ${fontSans.variable} ${fontDisplay.variable}`}
      >
         <body className="min-h-screen overflow-x-clip bg-surface-page text-text-primary font-sans antialiased selection:bg-surface-nested selection:text-white">
            <TooltipProvider delayDuration={200}>
               <LogRocketProvider
                  user={session?.user ?? null}
                  enabled={flags[FEATURE_FLAG_KEYS.logrocket] ?? false}
               />
               <Suspense
                  fallback={
                     <div className="h-16 border-b border-border-subtle bg-surface-page" />
                  }
               >
                  <AppHeader
                     user={effectiveUser}
                     isActualAdmin={isActualAdmin}
                     isPreviewActive={isPreviewActive}
                     showPokemonNav={flags[FEATURE_FLAG_KEYS.pokemon]}
                     showLeaderboardNav={
                        flags[FEATURE_FLAG_KEYS.globalLeaderboard]
                     }
                     showWalletNav={flags[FEATURE_FLAG_KEYS.globalLeaderboard]}
                  />
               </Suspense>
               {children}
               <FeedbackTriggerButton />
               <Toaster />
            </TooltipProvider>
         </body>
      </html>
   );
}
