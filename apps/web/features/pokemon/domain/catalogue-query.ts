/**
 * Shared catalogue query constants/types (Law L7: no React/Prisma/Next imports).
 *
 * Filtering, sorting and pagination for the Pokédex catalogue run server-side
 * (see `features/pokemon/data/pokemon-catalogue.repository.ts`); this module only
 * holds the values shared between the server page/action and the client view.
 */

export const CATALOGUE_PAGE_SIZE = 24;

export type CatalogueSortKey =
   "pokedex" | "name" | "rarity_desc" | "rarity_asc" | "recent";

export type CatalogueScope = "catalogue" | "collection";
