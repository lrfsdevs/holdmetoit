"use server";

/**
 * HoldMeToIt — Pokemon Server Actions
 * Next.js Server Actions for Pokemon catalogue, Pokédex, and user collections.
 * Enforces server-side authentication, authorization, and input validation.
 */

import { auth } from "@/core/auth";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { revalidatePath } from "next/cache";
import {
   adminUpsertPokemonSpecies,
   countAvailablePokemonSpecies,
   findPokemonSpeciesById,
   findPokemonSpeciesBySlug,
   listPokemonSpecies,
   ListPokemonSpeciesOptions,
   PokemonSpeciesWithCounts,
} from "../data/pokemon-catalogue.repository";
import {
   getUserCollectionSummary,
   getUserPokemonById,
   getUserPokemonCollection,
   UserCollectionFilterOptions,
   UserCollectionSummary,
   UserPokemonInstance,
} from "../data/user-pokemon.repository";
import {
   ListPokemonFilterSchema,
   UpsertPokemonSpeciesInput,
   UpsertPokemonSpeciesSchema,
   UserCollectionFilterSchema,
} from "../domain/pokemon.schema";

export type ActionResult<T> =
   { ok: true; data: T } | { ok: false; error: string; code?: string };

/**
 * Public action: Get Pokemon catalogue entries with optional filters.
 * Accessible by guests/spectators and authenticated users alike (Law L4).
 */
export async function getPokemonCatalogueAction(
   options: ListPokemonSpeciesOptions = {}
): Promise<
   ActionResult<{ species: PokemonSpeciesWithCounts[]; totalCount: number }>
> {
   try {
      const validated = ListPokemonFilterSchema.safeParse(options);
      if (!validated.success) {
         return {
            ok: false,
            error: "Invalid catalogue filter parameters",
            code: "INVALID_INPUT",
         };
      }

      const result = await listPokemonSpecies(validated.data);
      return { ok: true, data: result };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to retrieve Pokemon catalogue",
         code: "CATALOGUE_ERROR",
      };
   }
}

/**
 * Public action: Get detailed species information by ID or slug.
 */
export async function getPokemonSpeciesDetailAction(
   identifier: string
): Promise<ActionResult<PokemonSpeciesWithCounts | null>> {
   if (!identifier || typeof identifier !== "string") {
      return { ok: false, error: "Invalid identifier", code: "INVALID_INPUT" };
   }

   try {
      let species = await findPokemonSpeciesBySlug(identifier);
      if (!species) {
         species = await findPokemonSpeciesById(identifier);
      }

      return { ok: true, data: species };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load Pokemon species detail",
         code: "SPECIES_ERROR",
      };
   }
}

/**
 * Authenticated action: Get the current user's Pokemon collection.
 * The user ID is strictly extracted from the authenticated session.
 */
export async function getUserPokemonCollectionAction(
   options: UserCollectionFilterOptions = {}
): Promise<ActionResult<{ instances: UserPokemonInstance[] }>> {
   try {
      const session = await auth();
      if (!session?.user?.id) {
         return {
            ok: false,
            error: "Authentication required to view your Pokemon collection",
            code: "UNAUTHORIZED",
         };
      }

      const validated = UserCollectionFilterSchema.safeParse(options);
      if (!validated.success) {
         return {
            ok: false,
            error: "Invalid collection filter parameters",
            code: "INVALID_INPUT",
         };
      }

      const instances = await getUserPokemonCollection(
         session.user.id,
         validated.data
      );
      return { ok: true, data: { instances } };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to retrieve user collection",
         code: "COLLECTION_ERROR",
      };
   }
}

/**
 * Authenticated / Spectator action: Get current user's collection summary & Pokédex progress.
 * If user is not logged in, returns null summary indicating spectator state.
 */
export async function getUserCollectionSummaryAction(): Promise<
   ActionResult<{ summary: UserCollectionSummary | null; isSpectator: boolean }>
> {
   try {
      const session = await auth();
      if (!session?.user?.id) {
         return {
            ok: true,
            data: { summary: null, isSpectator: true },
         };
      }

      const summary = await getUserCollectionSummary(session.user.id);
      return {
         ok: true,
         data: { summary, isSpectator: false },
      };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load collection summary",
         code: "SUMMARY_ERROR",
      };
   }
}

/**
 * Authenticated action: Get single owned Pokemon instance with ownership verification.
 */
export async function getUserPokemonInstanceAction(
   instanceId: string
): Promise<ActionResult<UserPokemonInstance | null>> {
   try {
      const session = await auth();
      if (!session?.user?.id) {
         return {
            ok: false,
            error: "Authentication required",
            code: "UNAUTHORIZED",
         };
      }

      const instance = await getUserPokemonById(instanceId, session.user.id);
      if (!instance) {
         return {
            ok: false,
            error: "Pokemon instance not found or access denied",
            code: "NOT_FOUND",
         };
      }

      return { ok: true, data: instance };
   } catch (error) {
      return {
         ok: false,
         error: "Failed to load Pokemon instance",
         code: "INSTANCE_ERROR",
      };
   }
}

/**
 * Admin action: Upsert a Pokemon species in the catalogue.
 * Strictly gated by requireAdminUser().
 */
export async function adminUpsertPokemonSpeciesAction(
   input: UpsertPokemonSpeciesInput
): Promise<ActionResult<PokemonSpeciesWithCounts>> {
   try {
      const admin = await requireAdminUser();

      const validated = UpsertPokemonSpeciesSchema.safeParse(input);
      if (!validated.success) {
         return {
            ok: false,
            error:
               validated.error.issues?.[0]?.message ||
               (validated.error as any).errors?.[0]?.message ||
               "Invalid species data",
            code: "VALIDATION_FAILED",
         };
      }

      const species = await adminUpsertPokemonSpecies(validated.data, admin.id);
      revalidatePath("/pokemon");
      revalidatePath("/pokedex");

      return { ok: true, data: species };
   } catch (error: any) {
      if (
         error?.name === "AdminAccessError" ||
         error?.code === "FORBIDDEN_NOT_ADMIN"
      ) {
         return {
            ok: false,
            error: "Administrator permissions required",
            code: "FORBIDDEN",
         };
      }

      return {
         ok: false,
         error: error?.message || "Failed to update Pokemon species",
         code: "ADMIN_ERROR",
      };
   }
}
