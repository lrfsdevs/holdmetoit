import { listFeatureFlags } from "@/features/feature-flags/data/feature-flags.repository";
import { DevBoardView } from "@/features/feature-flags/presentation/devboard-view";
import type { FeatureFlagEntity } from "@/features/feature-flags/domain/feature-flags.types";
import { resolveDevBoardTab } from "@/features/feature-flags/domain/devboard-tabs";

export const dynamic = "force-dynamic";

interface DevBoardPageProps {
   searchParams?: {
      tab?: string | string[];
   };
}

/** Loads feature flags and restores the active DevBoard section from `?tab=`. */
export default async function DevBoardPage({
   searchParams,
}: DevBoardPageProps) {
   const flags = await listFeatureFlags();
   const initialTab = resolveDevBoardTab(searchParams?.tab);

   return (
      <DevBoardView
         initialFlags={flags as unknown as FeatureFlagEntity[]}
         initialTab={initialTab}
      />
   );
}
