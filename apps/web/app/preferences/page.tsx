import type { Metadata } from "next";
import { PreferencesView } from "@/features/preferences/presentation/preferences-view";

export const metadata: Metadata = {
   title: "Preferences | HoldMeToIt",
   description:
      "Customize audio feedback, visual themes, and notification preferences.",
};

export default function PreferencesPage() {
   return (
      <main className="min-h-[calc(100vh-4rem)] bg-surface-page pb-16">
         <PreferencesView />
      </main>
   );
}
