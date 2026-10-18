import { listFeatureFlags } from "@/features/feature-flags/data/feature-flags.repository";
import { DevBoardView } from "@/features/feature-flags/presentation/devboard-view";
import type { FeatureFlagEntity } from "@/features/feature-flags/domain/feature-flags.types";

export const dynamic = "force-dynamic";

/** Loads active feature flags for the developer control board. */
export default async function DevBoardPage() {
   const flags = await listFeatureFlags();

   return (
      <DevBoardView initialFlags={flags as unknown as FeatureFlagEntity[]} />
   );
}
