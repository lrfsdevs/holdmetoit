import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";

import { auth } from "@/core/auth";
import { LogRocketProvider } from "@/core/observability/logrocket-provider";
import { FeedbackTriggerButton } from "@/features/feedback/presentation/feedback-trigger-button";

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

  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontDisplay.variable}`}
    >
      <body className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] font-sans antialiased selection:bg-[#292929] selection:text-[#ffffff]">
        <LogRocketProvider user={session?.user ?? null} />
        {children}
        <FeedbackTriggerButton />
      </body>
    </html>
  );
}
