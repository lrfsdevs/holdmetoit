import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import { prisma } from "@/core/db";
import { AppHeader } from "@/features/auth/presentation/auth-nav";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { listPokemonSpecies } from "@/features/pokemon/data/pokemon-catalogue.repository";
import {
   getUserCollectionSummary,
   getUserPokemonCollection,
} from "@/features/pokemon/data/user-pokemon.repository";
import { listBanners } from "@/features/pokemon/data/acquisition.repository";
import { getOrCreateWallet } from "@/features/economy/data/wallet.repository";
import { PokemonView } from "@/features/pokemon/presentation/pokemon-view";
import { PityState } from "@/features/pokemon/domain/acquisition/pity-engine";

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
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive, isAdmin } = getEffectiveAdminState({
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
      listPokemonSpecies({ isAvailable: true, sortBy: "pokedex" }),
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
      <div className="min-h-screen bg-obsidian-bg text-obsidian-text">
         <AppHeader
            user={session?.user ?? null}
            isActualAdmin={isActualAdmin}
            isPreviewActive={isPreviewActive}
            subtitle="Pokédex"
         />
         <main className="mx-auto max-w-6xl px-3 sm:px-6 py-6 sm:py-8">
            <PokemonView
               initialSpecies={catalogueResult.species}
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
