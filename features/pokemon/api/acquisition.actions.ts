"use server";

/**
 * HoldMeToIt — Pokemon Acquisition & Banner Server Actions
 * Next.js Server Actions enforcing session authentication, role authorization,
 * Zod input validation, and atomic transaction execution.
 */

import { auth } from "@/core/auth";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
   AcquisitionResultViewModel,
   BannerViewModel,
   executePokemonAcquisition,
   findBannerByIdOrSlug,
   getUserBannerPity,
   listBanners,
} from "../data/acquisition.repository";
import {
   getUserAcquisitionHistory,
   PaginatedAcquisitionHistory,
} from "../data/acquisition-history.repository";
import {
   assertValidBannerConfig,
   BannerConfig,
   BannerStatus,
} from "../domain/acquisition/banner-config";
import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";

export type ActionResult<T> =
   { ok: true; data: T } | { ok: false; error: string; code?: string };

const PullPokemonSchema = z.object({
   bannerId: z.string().min(1, "Banner ID is required"),
   idempotencyKey: z.string().min(1, "Idempotency key is required").max(255),
});

const AcquisitionHistoryQuerySchema = z.object({
   bannerId: z.string().optional(),
   limit: z.number().int().min(1).max(50).optional(),
   cursor: z.string().optional(),
});

/**
 * Public action: List active banners for summon exploration.
 * Accessible to spectators and participants alike (Law L4).
 */
export async function listActiveBannersAction(): Promise<
   ActionResult<{ banners: BannerViewModel[] }>
> {
   try {
      const banners = await listBanners({ includeInactive: false });
      return { ok: true, data: { banners } };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load active summon banners.",
         code: "BANNERS_LOAD_FAILED",
      };
   }
}

/**
 * Public action: Get detailed banner information.
 */
export async function getBannerDetailAction(
   slugOrId: string
): Promise<ActionResult<BannerViewModel | null>> {
   if (!slugOrId || typeof slugOrId !== "string") {
      return {
         ok: false,
         error: "Invalid banner identifier",
         code: "INVALID_INPUT",
      };
   }

   try {
      const banner = await findBannerByIdOrSlug(slugOrId);
      return { ok: true, data: banner };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load banner details.",
         code: "BANNER_DETAIL_FAILED",
      };
   }
}

/**
 * Authenticated action: Get user's pity count and 50/50 status for a banner.
 */
export async function getUserBannerPityAction(
   bannerId: string
): Promise<ActionResult<{ pityCount: number; guaranteedFeatured: boolean }>> {
   const session = await auth();
   const userId = session?.user?.id;

   if (!userId) {
      return {
         ok: false,
         error: "Authentication required.",
         code: "UNAUTHORIZED",
      };
   }

   try {
      const pity = await getUserBannerPity(userId, bannerId);
      return { ok: true, data: pity };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load pity progress.",
         code: "PITY_LOAD_FAILED",
      };
   }
}

/**
 * Authenticated action: Execute an atomic, server-authoritative Pokémon pull.
 */
export async function pullPokemonAction(input: {
   bannerId: string;
   idempotencyKey: string;
}): Promise<ActionResult<AcquisitionResultViewModel>> {
   const session = await auth();
   const userId = session?.user?.id;

   if (!userId) {
      return {
         ok: false,
         error: "Please log in to summon Pokémon companions.",
         code: "UNAUTHORIZED",
      };
   }

   const parseResult = PullPokemonSchema.safeParse(input);
   if (!parseResult.success) {
      const errMsg =
         parseResult.error.issues?.[0]?.message ||
         parseResult.error.message ||
         "Invalid input parameters.";
      return {
         ok: false,
         error: errMsg,
         code: "INVALID_INPUT",
      };
   }

   try {
      const result = await executePokemonAcquisition({
         userId,
         bannerId: parseResult.data.bannerId,
         idempotencyKey: parseResult.data.idempotencyKey,
      });

      revalidatePath("/pokemon");
      revalidatePath("/wallet");

      return { ok: true, data: result };
   } catch (error: any) {
      const message =
         error instanceof Error ? error.message : "Failed to execute summon.";
      const code = error?.code || "ACQUISITION_FAILED";

      return {
         ok: false,
         error: message,
         code,
      };
   }
}

/**
 * Authenticated action: Get user's personal paginated acquisition history.
 */
export async function getUserAcquisitionHistoryAction(
   options: { bannerId?: string; limit?: number; cursor?: string } = {}
): Promise<ActionResult<PaginatedAcquisitionHistory>> {
   const session = await auth();
   const userId = session?.user?.id;

   if (!userId) {
      return {
         ok: false,
         error: "Authentication required.",
         code: "UNAUTHORIZED",
      };
   }

   const parsed = AcquisitionHistoryQuerySchema.safeParse(options);
   if (!parsed.success) {
      return {
         ok: false,
         error: "Invalid query parameters",
         code: "INVALID_INPUT",
      };
   }

   try {
      const history = await getUserAcquisitionHistory({
         userId,
         ...parsed.data,
      });
      return { ok: true, data: history };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to retrieve acquisition history.",
         code: "HISTORY_LOAD_FAILED",
      };
   }
}

// ---------------------------------------------------------------------------
// Administrative Actions (Gated by requireAdminUser())
// ---------------------------------------------------------------------------

/**
 * Admin action: List all banners including drafts and paused banners.
 */
export async function adminListAllBannersAction(): Promise<
   ActionResult<{ banners: BannerViewModel[] }>
> {
   try {
      await requireAdminUser();
      const banners = await listBanners({ includeInactive: true });
      return { ok: true, data: { banners } };
   } catch (error: any) {
      return {
         ok: false,
         error:
            error instanceof Error
               ? error.message
               : "Failed to load admin banner list.",
         code: "ADMIN_BANNERS_FAILED",
      };
   }
}

/**
 * Admin action: Create a new banner in DRAFT status.
 */
export async function adminCreateBannerAction(
   config: BannerConfig
): Promise<ActionResult<{ bannerId: string }>> {
   try {
      const admin = await requireAdminUser();
      assertValidBannerConfig(config);

      const created = await prisma.pokemonBanner.create({
         data: {
            name: config.name,
            slug: config.slug,
            description: config.description,
            bannerType: config.bannerType ?? "STANDARD",
            status: config.status ?? "DRAFT",
            startAt: new Date(config.startAt),
            endAt: config.endAt ? new Date(config.endAt) : null,
            pullCost: config.pullCost,
            allowedQuantities: config.allowedQuantities ?? [1],
            version: 1,
            featuredSpeciesId: config.featuredSpeciesId ?? null,
            rarityRates: config.rarityRates as any,
            poolFilter: config.poolFilter as any,
            pityConfig: config.pityConfig as any,
            duplicatePolicy: config.duplicatePolicy ?? "ADD_COPY",
            createdById: admin.id,
            updatedById: admin.id,
         },
      });

      revalidatePath("/pokemon");

      return { ok: true, data: { bannerId: created.id } };
   } catch (error: any) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to create banner.",
         code: error?.code || "ADMIN_BANNER_CREATE_FAILED",
      };
   }
}

/**
 * Admin action: Update banner configuration and increment version.
 */
export async function adminUpdateBannerAction(
   bannerId: string,
   config: Partial<BannerConfig>
): Promise<ActionResult<{ updated: boolean }>> {
   const admin = await requireAdminUser();

   try {
      const existing = await prisma.pokemonBanner.findUnique({
         where: { id: bannerId },
      });

      if (!existing) {
         return { ok: false, error: "Banner not found", code: "NOT_FOUND" };
      }

      const mergedConfig: BannerConfig = {
         name: config.name ?? existing.name,
         slug: config.slug ?? existing.slug,
         description: config.description ?? existing.description,
         bannerType: config.bannerType ?? existing.bannerType,
         status: (config.status ?? existing.status) as BannerStatus,
         startAt: config.startAt ?? existing.startAt,
         endAt: config.endAt !== undefined ? config.endAt : existing.endAt,
         pullCost: config.pullCost ?? existing.pullCost,
         allowedQuantities:
            config.allowedQuantities ?? existing.allowedQuantities,
         version: existing.version + 1,
         featuredSpeciesId:
            config.featuredSpeciesId !== undefined
               ? config.featuredSpeciesId
               : existing.featuredSpeciesId,
         rarityRates: (config.rarityRates ?? existing.rarityRates) as Record<
            string,
            number
         >,
         poolFilter:
            config.poolFilter !== undefined
               ? config.poolFilter
               : (existing.poolFilter as any),
         pityConfig:
            config.pityConfig !== undefined
               ? config.pityConfig
               : (existing.pityConfig as any),
         duplicatePolicy: (config.duplicatePolicy ??
            existing.duplicatePolicy) as any,
      };

      assertValidBannerConfig(mergedConfig);

      await prisma.pokemonBanner.update({
         where: { id: bannerId },
         data: {
            name: mergedConfig.name,
            slug: mergedConfig.slug,
            description: mergedConfig.description,
            bannerType: mergedConfig.bannerType,
            status: mergedConfig.status as any,
            startAt: new Date(mergedConfig.startAt),
            endAt: mergedConfig.endAt ? new Date(mergedConfig.endAt) : null,
            pullCost: mergedConfig.pullCost,
            allowedQuantities: mergedConfig.allowedQuantities,
            featuredSpeciesId: mergedConfig.featuredSpeciesId ?? null,
            rarityRates: mergedConfig.rarityRates as any,
            poolFilter: mergedConfig.poolFilter
               ? (mergedConfig.poolFilter as any)
               : Prisma.JsonNull,
            pityConfig: mergedConfig.pityConfig
               ? (mergedConfig.pityConfig as any)
               : Prisma.JsonNull,
            duplicatePolicy: mergedConfig.duplicatePolicy as any,
            version: existing.version + 1,
            updatedById: admin.id,
         },
      });

      revalidatePath("/pokemon");

      return { ok: true, data: { updated: true } };
   } catch (error: any) {
      return {
         ok: false,
         error:
            error instanceof Error ? error.message : "Failed to update banner.",
         code: error?.code || "ADMIN_BANNER_UPDATE_FAILED",
      };
   }
}

/**
 * Admin action: Toggle or set banner status (ACTIVE, PAUSED, ENDED, DISABLED).
 */
export async function adminSetBannerStatusAction(
   bannerId: string,
   status: BannerStatus
): Promise<ActionResult<{ updated: boolean }>> {
   const admin = await requireAdminUser();

   try {
      await prisma.pokemonBanner.update({
         where: { id: bannerId },
         data: {
            status,
            updatedById: admin.id,
         },
      });

      revalidatePath("/pokemon");

      return { ok: true, data: { updated: true } };
   } catch (error: any) {
      return {
         ok: false,
         error:
            error instanceof Error
               ? error.message
               : "Failed to set banner status.",
         code: "ADMIN_STATUS_UPDATE_FAILED",
      };
   }
}
