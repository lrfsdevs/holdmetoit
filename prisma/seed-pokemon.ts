/**
 * HoldMeToIt — Pokemon Catalogue Seed Script
 * Deterministic, idempotent seeding of PokemonSpecies.
 * Uses official Pokédex (https://www.pokemon.com/us/pokedex) as the reference.
 */

import { PrismaClient, PokemonRarity } from "@prisma/client";

export interface SeedPokemonItem {
   pokedexNumber: number;
   name: string;
   slug: string;
   rarity: PokemonRarity;
   primaryType: string;
   secondaryType?: string | null;
   description: string;
   classification: string;
   imageUrl?: string;
   spriteUrl?: string;
   baseHp: number;
   baseAttack: number;
   baseDefense: number;
   generation: number;
   isAvailable: boolean;
   referenceUrl: string;
}

export const SEED_POKEMON_CATALOGUE: SeedPokemonItem[] = [
   // NORMAL RARITY
   {
      pokedexNumber: 10,
      name: "Caterpie",
      slug: "caterpie",
      rarity: "NORMAL",
      primaryType: "BUG",
      secondaryType: null,
      classification: "Worm Pokémon",
      description:
         "For protection, it releases a horrible stench from the antennae on its head to drive away enemies.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10.png",
      baseHp: 45,
      baseAttack: 30,
      baseDefense: 35,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/caterpie",
   },
   {
      pokedexNumber: 16,
      name: "Pidgey",
      slug: "pidgey",
      rarity: "NORMAL",
      primaryType: "NORMAL",
      secondaryType: "FLYING",
      classification: "Tiny Bird Pokémon",
      description:
         "Very docile. If attacked, it will often kick up sand by flapping its wings rather than fight back.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/16.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/16.png",
      baseHp: 40,
      baseAttack: 45,
      baseDefense: 40,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/pidgey",
   },
   {
      pokedexNumber: 19,
      name: "Rattata",
      slug: "rattata",
      rarity: "NORMAL",
      primaryType: "NORMAL",
      secondaryType: null,
      classification: "Mouse Pokémon",
      description:
         "Will chew on anything with its sharp fangs. If you see one, you can be sure there are 40 more around.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/19.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/19.png",
      baseHp: 30,
      baseAttack: 56,
      baseDefense: 35,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/rattata",
   },
   {
      pokedexNumber: 39,
      name: "Jigglypuff",
      slug: "jigglypuff",
      rarity: "NORMAL",
      primaryType: "NORMAL",
      secondaryType: "FAIRY",
      classification: "Balloon Pokémon",
      description:
         "When its huge eyes waver, it sings a mysteriously soothing melody that lulls enemies to sleep.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/39.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png",
      baseHp: 115,
      baseAttack: 45,
      baseDefense: 20,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/jigglypuff",
   },
   {
      pokedexNumber: 54,
      name: "Psyduck",
      slug: "psyduck",
      rarity: "NORMAL",
      primaryType: "WATER",
      secondaryType: null,
      classification: "Duck Pokémon",
      description:
         "If its chronic headache intensifies, it begins using mysterious, powerful psychic oddities.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/54.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png",
      baseHp: 50,
      baseAttack: 52,
      baseDefense: 48,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/psyduck",
   },

   // UNCOMMON RARITY (Starters)
   {
      pokedexNumber: 1,
      name: "Bulbasaur",
      slug: "bulbasaur",
      rarity: "UNCOMMON",
      primaryType: "GRASS",
      secondaryType: "POISON",
      classification: "Seed Pokémon",
      description:
         "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
      baseHp: 45,
      baseAttack: 49,
      baseDefense: 49,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/bulbasaur",
   },
   {
      pokedexNumber: 4,
      name: "Charmander",
      slug: "charmander",
      rarity: "UNCOMMON",
      primaryType: "FIRE",
      secondaryType: null,
      classification: "Lizard Pokémon",
      description:
         "The flame on its tail indicates Charmander's life force. If healthy, the flame burns brightly.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
      baseHp: 39,
      baseAttack: 52,
      baseDefense: 43,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/charmander",
   },
   {
      pokedexNumber: 7,
      name: "Squirtle",
      slug: "squirtle",
      rarity: "UNCOMMON",
      primaryType: "WATER",
      secondaryType: null,
      classification: "Tiny Turtle Pokémon",
      description:
         "Shoots water at prey while in the water. Withdraws into its shell when in danger.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png",
      baseHp: 44,
      baseAttack: 48,
      baseDefense: 65,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/squirtle",
   },

   // RARE RARITY
   {
      pokedexNumber: 25,
      name: "Pikachu",
      slug: "pikachu",
      rarity: "RARE",
      primaryType: "ELECTRIC",
      secondaryType: null,
      classification: "Mouse Pokémon",
      description:
         "When several of these Pokémon gather, their electricity can build and cause lightning storms.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      baseHp: 35,
      baseAttack: 55,
      baseDefense: 40,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/pikachu",
   },
   {
      pokedexNumber: 133,
      name: "Eevee",
      slug: "eevee",
      rarity: "RARE",
      primaryType: "NORMAL",
      secondaryType: null,
      classification: "Evolution Pokémon",
      description:
         "Its genetic code is irregular. It may mutate if it is exposed to radiation from element stones.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png",
      baseHp: 55,
      baseAttack: 55,
      baseDefense: 50,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/eevee",
   },

   // EPIC RARITY
   {
      pokedexNumber: 94,
      name: "Gengar",
      slug: "gengar",
      rarity: "EPIC",
      primaryType: "GHOST",
      secondaryType: "POISON",
      classification: "Shadow Pokémon",
      description:
         "Under a full moon, this Pokémon likes to mimic the shadows of people and laugh at their fright.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png",
      baseHp: 60,
      baseAttack: 65,
      baseDefense: 60,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/gengar",
   },
   {
      pokedexNumber: 130,
      name: "Gyarados",
      slug: "gyarados",
      rarity: "EPIC",
      primaryType: "WATER",
      secondaryType: "FLYING",
      classification: "Atrocious Pokémon",
      description:
         "Rarely seen in the wild. Huge and vicious, it is capable of destroying entire cities in a rage.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/130.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png",
      baseHp: 95,
      baseAttack: 125,
      baseDefense: 79,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/gyarados",
   },
   {
      pokedexNumber: 143,
      name: "Snorlax",
      slug: "snorlax",
      rarity: "EPIC",
      primaryType: "NORMAL",
      secondaryType: null,
      classification: "Sleeping Pokémon",
      description:
         "Very lazy. Just eats and sleeps. As its enormous bulk builds, it becomes even more reluctant to move.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png",
      baseHp: 160,
      baseAttack: 110,
      baseDefense: 65,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/snorlax",
   },
   {
      pokedexNumber: 149,
      name: "Dragonite",
      slug: "dragonite",
      rarity: "EPIC",
      primaryType: "DRAGON",
      secondaryType: "FLYING",
      classification: "Dragon Pokémon",
      description:
         "An extremely rarely seen marine Pokémon. Its intelligence is said to match that of humans.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/149.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png",
      baseHp: 91,
      baseAttack: 134,
      baseDefense: 95,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/dragonite",
   },
   {
      pokedexNumber: 448,
      name: "Lucario",
      slug: "lucario",
      rarity: "EPIC",
      primaryType: "FIGHTING",
      secondaryType: "STEEL",
      classification: "Aura Pokémon",
      description:
         "By reading the auras of all things, it can tell how others are feeling from over half a mile away.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/448.png",
      baseHp: 70,
      baseAttack: 110,
      baseDefense: 70,
      generation: 4,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/lucario",
   },

   // LEGENDARY RARITY
   {
      pokedexNumber: 150,
      name: "Mewtwo",
      slug: "mewtwo",
      rarity: "LEGENDARY",
      primaryType: "PSYCHIC",
      secondaryType: null,
      classification: "Genetic Pokémon",
      description:
         "It was created by a scientist after years of horrific gene-splicing and DNA engineering experiments.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png",
      baseHp: 106,
      baseAttack: 110,
      baseDefense: 90,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/mewtwo",
   },
   {
      pokedexNumber: 249,
      name: "Lugia",
      slug: "lugia",
      rarity: "LEGENDARY",
      primaryType: "PSYCHIC",
      secondaryType: "FLYING",
      classification: "Diving Pokémon",
      description:
         "It sleeps in a deep sea trench. If it flaps its wings, it is said to cause a 40-day storm.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/249.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/249.png",
      baseHp: 106,
      baseAttack: 90,
      baseDefense: 130,
      generation: 2,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/lugia",
   },
   {
      pokedexNumber: 250,
      name: "Ho-Oh",
      slug: "ho-oh",
      rarity: "LEGENDARY",
      primaryType: "FIRE",
      secondaryType: "FLYING",
      classification: "Rainbow Pokémon",
      description:
         "A legend says that its body glows in seven colors. A rainbow is said to form behind it when it flies.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/250.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/250.png",
      baseHp: 106,
      baseAttack: 130,
      baseDefense: 90,
      generation: 2,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/ho-oh",
   },
   {
      pokedexNumber: 384,
      name: "Rayquaza",
      slug: "rayquaza",
      rarity: "LEGENDARY",
      primaryType: "DRAGON",
      secondaryType: "FLYING",
      classification: "Sky High Pokémon",
      description:
         "It flies forever through the ozone layer, consuming meteoroids for sustenance.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/384.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/384.png",
      baseHp: 105,
      baseAttack: 150,
      baseDefense: 90,
      generation: 3,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/rayquaza",
   },

   // MYTHICAL RARITY
   {
      pokedexNumber: 151,
      name: "Mew",
      slug: "mew",
      rarity: "MYTHICAL",
      primaryType: "PSYCHIC",
      secondaryType: null,
      classification: "New Species Pokémon",
      description:
         "So rare that it is still said to be a mirage by many experts. Only a few people have seen it worldwide.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/151.png",
      baseHp: 100,
      baseAttack: 100,
      baseDefense: 100,
      generation: 1,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/mew",
   },
   {
      pokedexNumber: 251,
      name: "Celebi",
      slug: "celebi",
      rarity: "MYTHICAL",
      primaryType: "PSYCHIC",
      secondaryType: "GRASS",
      classification: "Time Travel Pokémon",
      description:
         "This Pokémon wanders across time. Grass and trees flourish in any forest where it has appeared.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/251.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/251.png",
      baseHp: 100,
      baseAttack: 100,
      baseDefense: 100,
      generation: 2,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/celebi",
   },
   {
      pokedexNumber: 385,
      name: "Jirachi",
      slug: "jirachi",
      rarity: "MYTHICAL",
      primaryType: "STEEL",
      secondaryType: "PSYCHIC",
      classification: "Wish Pokémon",
      description:
         "Generations have believed that any wish written on a note on its head will come true when it awakens.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/385.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/385.png",
      baseHp: 100,
      baseAttack: 100,
      baseDefense: 100,
      generation: 3,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/jirachi",
   },
   {
      pokedexNumber: 493,
      name: "Arceus",
      slug: "arceus",
      rarity: "MYTHICAL",
      primaryType: "NORMAL",
      secondaryType: null,
      classification: "Alpha Pokémon",
      description:
         "It is described in mythology as the Pokémon that was born before the universe even existed.",
      imageUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/493.png",
      spriteUrl:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/493.png",
      baseHp: 120,
      baseAttack: 120,
      baseDefense: 120,
      generation: 4,
      isAvailable: true,
      referenceUrl: "https://www.pokemon.com/us/pokedex/arceus",
   },
];

export async function seedPokemonCatalogue(prismaClient: PrismaClient) {
   console.log(
      `[seed-pokemon] Starting idempotent seed for ${SEED_POKEMON_CATALOGUE.length} Pokemon species...`
   );

   let createdCount = 0;
   let updatedCount = 0;

   for (const item of SEED_POKEMON_CATALOGUE) {
      const existing = await prismaClient.pokemonSpecies.findUnique({
         where: { slug: item.slug },
      });

      await prismaClient.pokemonSpecies.upsert({
         where: { slug: item.slug },
         update: {
            pokedexNumber: item.pokedexNumber,
            name: item.name,
            rarity: item.rarity,
            primaryType: item.primaryType,
            secondaryType: item.secondaryType ?? null,
            description: item.description,
            classification: item.classification,
            imageUrl: item.imageUrl ?? null,
            spriteUrl: item.spriteUrl ?? null,
            baseHp: item.baseHp,
            baseAttack: item.baseAttack,
            baseDefense: item.baseDefense,
            generation: item.generation,
            isAvailable: item.isAvailable,
            referenceUrl: item.referenceUrl,
         },
         create: {
            pokedexNumber: item.pokedexNumber,
            name: item.name,
            slug: item.slug,
            rarity: item.rarity,
            primaryType: item.primaryType,
            secondaryType: item.secondaryType ?? null,
            description: item.description,
            classification: item.classification,
            imageUrl: item.imageUrl ?? null,
            spriteUrl: item.spriteUrl ?? null,
            baseHp: item.baseHp,
            baseAttack: item.baseAttack,
            baseDefense: item.baseDefense,
            generation: item.generation,
            isAvailable: item.isAvailable,
            referenceUrl: item.referenceUrl,
         },
      });

      if (existing) {
         updatedCount++;
      } else {
         createdCount++;
      }
   }

   console.log(
      `[seed-pokemon] Completed: ${createdCount} created, ${updatedCount} updated.`
   );
}

async function standalone() {
   const prisma = new PrismaClient();
   try {
      await seedPokemonCatalogue(prisma);
   } finally {
      await prisma.$disconnect();
   }
}

if (require.main === module) {
   standalone().catch((e) => {
      console.error("[seed-pokemon] Error running standalone seed:", e);
      process.exit(1);
   });
}
