import type { Metadata } from "next";
import { cookies } from "next/headers";

import { auth } from "@/core/auth";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { getChangelogGroups } from "@/features/changelog/data/changelog.repository";
import { ChangelogView } from "@/features/changelog/presentation/changelog-view";

export const metadata: Metadata = {
   title: "Changelog | HoldMeToIt",
   description: "Product updates and improvements, newest first.",
};

export default async function ChangelogPage() {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
   });

   const groups = getChangelogGroups();

   return <ChangelogView groups={groups} isAdmin={isAdmin} />;
}
