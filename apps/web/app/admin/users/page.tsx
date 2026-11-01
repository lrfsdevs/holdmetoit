import { Metadata } from "next";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { getAdminUserRoster } from "@/features/admin/data/user-directory.repository";
import { UserDirectoryView } from "@/features/admin/presentation/user-directory-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
   title: "User Directory & Roster — HoldMeToIt Host Admin",
   description:
      "Global platform directory of registered members, active battle participants, and host administration controls.",
};

export default async function AdminUsersPage() {
   const admin = await requireAdminUser();
   const initialData = await getAdminUserRoster({ page: 1, pageSize: 15 });

   return (
      <UserDirectoryView initialData={initialData} currentAdminId={admin.id} />
   );
}
