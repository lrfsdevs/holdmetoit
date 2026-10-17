/**
 * HoldMeToIt — Pokemon Rarity Domain Model
 * Pure domain logic (Law L7: Pure Domain Isolation, zero framework/ORM imports).
 */

export const POKEMON_RARITIES = [
   "NORMAL",
   "UNCOMMON",
   "RARE",
   "EPIC",
   "LEGENDARY",
   "MYTHICAL",
] as const;

export type PokemonRarity = (typeof POKEMON_RARITIES)[number];

export interface PokemonRarityConfig {
   rarity: PokemonRarity;
   label: string;
   rank: number; // 1 to 6
   stars: number; // visual stars (e.g. Genshin / WuWa style)
   indicativePrice: number; // Planning reference value for future economy integration
   textColor: string;
   borderColor: string;
   bgColor: string;
   glowColor: string;
   gradient: string;
}

/**
 * Visual styling and metadata for each rarity tier.
 * Styled in accordance with DESIGN.md (Obsidian Dark palette with vibrant accent glows).
 */
export const POKEMON_RARITY_CONFIGS: Record<
   PokemonRarity,
   PokemonRarityConfig
> = {
   NORMAL: {
      rarity: "NORMAL",
      label: "Normal",
      rank: 1,
      stars: 1,
      indicativePrice: 10_000,
      textColor: "text-slate-300",
      borderColor: "border-slate-700/60",
      bgColor: "bg-slate-800/40",
      glowColor: "shadow-slate-500/10",
      gradient: "from-slate-700/30 to-slate-900/40",
   },
   UNCOMMON: {
      rarity: "UNCOMMON",
      label: "Uncommon",
      rank: 2,
      stars: 2,
      indicativePrice: 50_000,
      textColor: "text-emerald-400",
      borderColor: "border-emerald-500/50",
      bgColor: "bg-emerald-950/30",
      glowColor: "shadow-emerald-500/20",
      gradient: "from-emerald-600/20 to-slate-900/40",
   },
   RARE: {
      rarity: "RARE",
      label: "Rare",
      rank: 3,
      stars: 3,
      indicativePrice: 100_000,
      textColor: "text-sky-400",
      borderColor: "border-sky-500/50",
      bgColor: "bg-sky-950/30",
      glowColor: "shadow-sky-500/20",
      gradient: "from-sky-600/20 to-slate-900/40",
   },
   EPIC: {
      rarity: "EPIC",
      label: "Epic",
      rank: 4,
      stars: 4,
      indicativePrice: 250_000,
      textColor: "text-purple-400",
      borderColor: "border-purple-500/60",
      bgColor: "bg-purple-950/30",
      glowColor: "shadow-purple-500/25",
      gradient: "from-purple-600/25 to-slate-900/40",
   },
   LEGENDARY: {
      rarity: "LEGENDARY",
      label: "Legendary",
      rank: 5,
      stars: 5,
      indicativePrice: 500_000,
      textColor: "text-amber-400",
      borderColor: "border-amber-500/70",
      bgColor: "bg-amber-950/30",
      glowColor: "shadow-amber-500/30",
      gradient: "from-amber-500/25 to-slate-900/50",
   },
   MYTHICAL: {
      rarity: "MYTHICAL",
      label: "Mythical",
      rank: 6,
      stars: 6,
      indicativePrice: 1_000_000,
      textColor: "text-rose-400",
      borderColor: "border-rose-500/80",
      bgColor: "bg-rose-950/40",
      glowColor: "shadow-rose-500/40",
      gradient: "from-rose-600/30 via-purple-600/20 to-slate-900/60",
   },
};

/**
 * Validates if a string is a valid PokemonRarity.
 */
export function isValidPokemonRarity(value: unknown): value is PokemonRarity {
   return (
      typeof value === "string" &&
      POKEMON_RARITIES.includes(value as PokemonRarity)
   );
}

/**
 * Stable comparator to sort rarities descending (Mythical -> Normal)
 * or ascending (Normal -> Mythical).
 */
export function compareRarity(
   a: PokemonRarity,
   b: PokemonRarity,
   direction: "asc" | "desc" = "desc"
): number {
   const rankA = POKEMON_RARITY_CONFIGS[a]?.rank ?? 0;
   const rankB = POKEMON_RARITY_CONFIGS[b]?.rank ?? 0;
   return direction === "desc" ? rankB - rankA : rankA - rankB;
}

/**
 * Get rarity config safely with fallback to NORMAL.
 */
export function getPokemonRarityConfig(rarity: unknown): PokemonRarityConfig {
   if (isValidPokemonRarity(rarity)) {
      return POKEMON_RARITY_CONFIGS[rarity];
   }
   return POKEMON_RARITY_CONFIGS.NORMAL;
}

/**
 * Calculates HoldMeToIt game economy rarity from source metadata.
 * Note: Keeps source classifications (legendary, mythical) separate from game rarity,
 * while providing an approved baseline heuristic based on Base Stat Total (BST).
 *
 * Product Decision Baseline:
 * - is_mythical -> MYTHICAL
 * - is_legendary -> LEGENDARY
 * - BST >= 540 (Pseudo-legendaries, elite aces) -> EPIC
 * - BST >= 450 (Fully evolved starters, mid-tier powerhouses) -> RARE
 * - BST >= 320 (Mid-stage evolutions, unevolved starters) -> UNCOMMON
 * - BST < 320 (Early-route species, baby Pokémon) -> NORMAL
 */
export function calculateHoldMeToItRarity(source: {
   isMythical?: boolean | null;
   isLegendary?: boolean | null;
   baseStatTotal?: number | null;
}): PokemonRarity {
   if (source.isMythical) return "MYTHICAL";
   if (source.isLegendary) return "LEGENDARY";
   const bst = source.baseStatTotal ?? 0;
   if (bst >= 540) return "EPIC";
   if (bst >= 450) return "RARE";
   if (bst >= 320) return "UNCOMMON";
   return "NORMAL";
}
