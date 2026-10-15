import { redirect } from "next/navigation";

/** Redirects the legacy admin landing route to the challenges directory. */
export default function AdminDashboardPage() {
   redirect("/challenges");
}
