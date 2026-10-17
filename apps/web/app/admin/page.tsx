import { Metadata } from "next";
import { AdminConsoleView } from "@/features/admin/presentation/admin-console-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
   title: "Administration Console — HoldMeToIt",
   description:
      "Review and verify member YPT identities, adjust trophy ratings, and monitor operations.",
};

export default function AdminDashboardPage() {
   return <AdminConsoleView />;
}
