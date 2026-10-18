import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import { prisma } from "@/core/db";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { listPokemonSpecies } from "@/features/pokemon/data/pokemon-catalogue.repository";
import { CATALOGUE_PAGE_SIZE } from "@/features/pokemon/domain/catalogue-query";
import {
   getUserCollectionSummary,
   getUserPokemonCollection,
} from "@/features/pokemon/data/user-pokemon.repository";
import { listBanners } from "@/features/pokemon/data/acquisition.repository";
import { getOrCreateWallet } from "@/features/economy/data/wallet.repository";
import { PokemonView } from "@/features/pokemon/presentation/pokemon-view";
import { PityState } from "@/features/pokemon/domain/acquisition/pity-engine";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { EmptyState } from "@/components/state/empty-state";

export const dynamic = "force-dynamic";

export const metadata = {
   title: "Pokédex & Pokémon Collection — HoldMeToIt",
   description:
      "Explore the Pokémon catalogue, summon companions, and view your personal study-backed companion collection.",
};

interface PokemonPageProps {
   searchParams?: {
      as?: string;
   };
}

export default async function PokemonPage({ searchParams }: PokemonPageProps) {
   const pokemonEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.pokemon);

   if (!pokemonEnabled) {
      return (
         <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
            <main className="mx-auto max-w-6xl px-3 sm:px-6 py-8">
               <EmptyState
                  title="Pokémon system is currently unavailable"
                  description="The Pokédex, summoning, and collection features are temporarily locked. Please check back later."
               />
            </main>
         </div>
      );
   }

   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: searchParams?.as,
   });

   const userId = session?.user?.id;
   const isSpectator = !userId;

   // Concurrently load available catalogue, user collection data, active banners, wallet, and pity
   const [
      catalogueResult,
      userSummary,
      userInstances,
      bannersResult,
      wallet,
      userPityRecords,
   ] = await Promise.all([
      listPokemonSpecies({
         isAvailable: true,
         sortBy: "pokedex",
         limit: CATALOGUE_PAGE_SIZE,
         offset: 0,
      }),
      userId ? getUserCollectionSummary(userId) : Promise.resolve(null),
      userId ? getUserPokemonCollection(userId) : Promise.resolve([]),
      listBanners({ includeInactive: false }),
      userId ? getOrCreateWallet(userId) : Promise.resolve(null),
      userId
         ? prisma.userBannerPity.findMany({ where: { userId } })
         : Promise.resolve([]),
   ]);

   const initialUserPities: Record<string, PityState> = {};
   for (const p of userPityRecords) {
      initialUserPities[p.bannerId] = {
         pityCount: p.pityCount,
         guaranteedFeatured: p.guaranteedFeatured,
      };
   }

   const availableCoins = wallet
      ? Math.max(0, wallet.totalBalance - wallet.reservedBalance)
      : 0;

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="mx-auto max-w-6xl px-3 sm:px-6 py-6 sm:py-8">
            <PokemonView
               initialSpecies={catalogueResult.species}
               initialTotalCount={catalogueResult.totalCount}
               initialSummary={userSummary}
               initialInstances={userInstances}
               initialBanners={bannersResult}
               initialUserPities={initialUserPities}
               userAvailableCoins={availableCoins}
               isAdmin={isAdmin}
               isSpectator={isSpectator}
            />
         </main>
      </div>
   );
}
