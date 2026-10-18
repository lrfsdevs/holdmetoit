/**
 * HoldMeToIt — Pokemon Elemental Types Domain Model
 * Pure domain logic (Law L7: Pure Domain Isolation, zero framework/ORM imports).
 * Official Pokémon Types reference.
 */

export const POKEMON_ELEMENTAL_TYPES = [
   "NORMAL",
   "FIRE",
   "WATER",
   "GRASS",
   "ELECTRIC",
   "ICE",
   "FIGHTING",
   "POISON",
   "GROUND",
   "FLYING",
   "PSYCHIC",
   "BUG",
   "ROCK",
   "GHOST",
   "DRAGON",
   "STEEL",
   "FAIRY",
   "DARK",
] as const;

export type PokemonElementalType = (typeof POKEMON_ELEMENTAL_TYPES)[number];

export interface PokemonTypeConfig {
   type: PokemonElementalType;
   label: string;
   badgeBg: string;
   badgeBorder: string;
   textColor: string;
}

export const POKEMON_TYPE_CONFIGS: Record<
   PokemonElementalType,
   PokemonTypeConfig
> = {
   NORMAL: {
      type: "NORMAL",
      label: "Normal",
      badgeBg: "bg-stone-500/20",
      badgeBorder: "border-stone-500/40",
      textColor: "text-stone-300",
   },
   FIRE: {
      type: "FIRE",
      label: "Fire",
      badgeBg: "bg-orange-500/20",
      badgeBorder: "border-orange-500/40",
      textColor: "text-orange-400",
   },
   WATER: {
      type: "WATER",
      label: "Water",
      badgeBg: "bg-blue-500/20",
      badgeBorder: "border-blue-500/40",
      textColor: "text-blue-400",
   },
   GRASS: {
      type: "GRASS",
      label: "Grass",
      badgeBg: "bg-emerald-500/20",
      badgeBorder: "border-emerald-500/40",
      textColor: "text-emerald-400",
   },
   ELECTRIC: {
      type: "ELECTRIC",
      label: "Electric",
      badgeBg: "bg-yellow-500/20",
      badgeBorder: "border-yellow-500/40",
      textColor: "text-yellow-400",
   },
   ICE: {
      type: "ICE",
      label: "Ice",
      badgeBg: "bg-cyan-500/20",
      badgeBorder: "border-cyan-500/40",
      textColor: "text-cyan-300",
   },
   FIGHTING: {
      type: "FIGHTING",
      label: "Fighting",
      badgeBg: "bg-red-700/20",
      badgeBorder: "border-red-600/40",
      textColor: "text-red-400",
   },
   POISON: {
      type: "POISON",
      label: "Poison",
      badgeBg: "bg-purple-600/20",
      badgeBorder: "border-purple-600/40",
      textColor: "text-purple-400",
   },
   GROUND: {
      type: "GROUND",
      label: "Ground",
      badgeBg: "bg-amber-700/20",
      badgeBorder: "border-amber-600/40",
      textColor: "text-amber-400",
   },
   FLYING: {
      type: "FLYING",
      label: "Flying",
      badgeBg: "bg-indigo-400/20",
      badgeBorder: "border-indigo-400/40",
      textColor: "text-indigo-300",
   },
   PSYCHIC: {
      type: "PSYCHIC",
      label: "Psychic",
      badgeBg: "bg-pink-600/20",
      badgeBorder: "border-pink-500/40",
      textColor: "text-pink-400",
   },
   BUG: {
      type: "BUG",
      label: "Bug",
      badgeBg: "bg-lime-600/20",
      badgeBorder: "border-lime-500/40",
      textColor: "text-lime-400",
   },
   ROCK: {
      type: "ROCK",
      label: "Rock",
      badgeBg: "bg-stone-600/20",
      badgeBorder: "border-stone-500/40",
      textColor: "text-stone-300",
   },
   GHOST: {
      type: "GHOST",
      label: "Ghost",
      badgeBg: "bg-violet-800/20",
      badgeBorder: "border-violet-700/40",
      textColor: "text-violet-300",
   },
   DRAGON: {
      type: "DRAGON",
      label: "Dragon",
      badgeBg: "bg-indigo-700/20",
      badgeBorder: "border-indigo-600/40",
      textColor: "text-indigo-300",
   },
   STEEL: {
      type: "STEEL",
      label: "Steel",
      badgeBg: "bg-slate-500/20",
      badgeBorder: "border-slate-400/40",
      textColor: "text-slate-300",
   },
   FAIRY: {
      type: "FAIRY",
      label: "Fairy",
      badgeBg: "bg-pink-400/20",
      badgeBorder: "border-pink-300/40",
      textColor: "text-pink-300",
   },
   DARK: {
      type: "DARK",
      label: "Dark",
      badgeBg: "bg-zinc-800/40",
      badgeBorder: "border-zinc-700/50",
      textColor: "text-zinc-300",
   },
};

export function isValidPokemonType(
   value: unknown
): value is PokemonElementalType {
   return (
      typeof value === "string" &&
      POKEMON_ELEMENTAL_TYPES.includes(
         value.toUpperCase() as PokemonElementalType
      )
   );
}

export function getPokemonTypeConfig(
   type: string | null | undefined
): PokemonTypeConfig | null {
   if (!type) return null;
   const upper = type.toUpperCase();
   if (isValidPokemonType(upper)) {
      return POKEMON_TYPE_CONFIGS[upper];
   }
   return null;
}
