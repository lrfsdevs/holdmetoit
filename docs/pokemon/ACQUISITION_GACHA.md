# Phase 4: Pokémon Acquisition, Gacha, Pity System & Cinematic Reveal

> **Status:** Implemented & Verified  
> **Target Release:** Phase 4  
> **Document Version:** 1.0.0  
> **Last Updated:** 2026-10-19

---

## 1. Executive Summary

Phase 4 introduces a server-authoritative, auditable Pokémon Acquisition & Summon Portal for HoldMeToIt. Authenticated participants can spend their study-earned HoldMeToIt coins to acquire Pokémon companions through configurable banners.

### Core Architectural Guarantees

1. **Zero Secondary Currency:** Operates exclusively using the existing HoldMeToIt coin wallet and immutable ledger. No premium currency, gems, cash purchases, or negative balances.
2. **Server Authority:** The server evaluates eligibility, active banner windows, wallet balances, CSPRNG rolls, pity state, duplicate handling, and ledger commitments. The client cannot manipulate outcomes.
3. **Atomic Financial Integrity:** Deducting coins, creating the immutable ledger transaction (`GACHA_PURCHASE`), granting companion ownership (`UserPokemon`), updating user pity (`UserBannerPity`), and recording the acquisition audit record (`PokemonAcquisition`) happen within a single serializable database transaction.
4. **Pure Domain Isolation (Law L7):** Configuration validation, pity evaluation, and probability rolls reside in pure TypeScript modules without ORM or React dependencies.
5. **Obsidian & Pokédex Theme Alignment:** All UI elements reuse obsidian background tokens, pokédex card containers, elemental rarity badges, and accessible modal interactions with reduced-motion support.

---

## 2. Architecture & Data Flow

```
Client UI (BannerCard / SummonPortal)
       │
       │ (1) pullPokemonAction({ bannerId, idempotencyKey })
       ▼
Server Action Boundary (Next.js Server Action)
       │
       │ (2) Session Auth & Zod Payload Validation
       ▼
Acquisition Repository (executePokemonAcquisition)
       │
       ├─► (3) Active Banner & Pool Fetch
       ├─► (4) Wallet Available-Balance Check (total - reserved >= pullCost)
       ├─► (5) User Banner Pity State Fetch
       │
       ├─► (6) Pure Domain Math:
       │         - evaluatePity()
       │         - selectPokemon() via CSPRNG (crypto.randomInt)
       │         - calculateNextPityState()
       │
       └─► (7) Prisma Serializable Transaction ($transaction):
                 ├─ Debit Coins (applyDebit)
                 ├─ Record Immutable Ledger Entry (type: "GACHA_PURCHASE")
                 ├─ Create UserPokemon (source: "GACHA", isDuplicate: true/false)
                 ├─ Upsert UserBannerPity (pityCount, guaranteedFeatured)
                 └─ Insert PokemonAcquisition (immutable historical snapshot)
       │
       ▼
Return Authoritative AcquisitionResultViewModel
       │
       ▼
Cinematic Reveal Modal (PokemonRevealModal)
       ├─ Anticipation (Pokéball energy orb + pulse)
       ├─ Flash Energy Burst (Rarity aura)
       └─ Result Details (Artwork, Rarity, Pokédex #, Duplicate tag, Updated balance)
```

---

## 3. Database Schema

### 3.1 `PokemonBanner`

Represents an acquisition portal with configurable pools, probability tables, and pity rules.

| Field               | Type                  | Description                                             |
| :------------------ | :-------------------- | :------------------------------------------------------ |
| `id`                | `String (cuid)`       | Unique banner identifier                                |
| `name`              | `String`              | Display title (e.g. _Kanto Starters Special_)           |
| `slug`              | `String (unique)`     | URL slug identifier                                     |
| `description`       | `String`              | Community-facing banner description                     |
| `bannerType`        | `String`              | Banner classification (`STANDARD`, `FEATURED`, `EVENT`) |
| `status`            | `PokemonBannerStatus` | `DRAFT`, `ACTIVE`, `PAUSED`, `ENDED`, `DISABLED`        |
| `startAt`           | `DateTime`            | Banner activation timestamp                             |
| `endAt`             | `DateTime?`           | Optional banner expiration timestamp                    |
| `pullCost`          | `Int`                 | Coin deduction per pull (safe integer > 0)              |
| `allowedQuantities` | `Int[]`               | Quantities allowed per request (e.g. `[1]`)             |
| `version`           | `Int`                 | Incremental configuration version for auditability      |
| `featuredSpeciesId` | `String?`             | Optional featured companion species ID                  |
| `rarityRates`       | `Json`                | Integer basis points per rarity (sum = 10,000)          |
| `poolFilter`        | `Json?`               | Optional pool filter criteria (generations, rarities)   |
| `pityConfig`        | `Json?`               | Hard pity threshold, target rarity, reset rarities      |
| `duplicatePolicy`   | `String`              | Duplicate policy (e.g. `INCREASE_COUNT`)                |

### 3.2 `UserBannerPity`

Stores per-user, per-banner pity tracking state.

| Field                | Type            | Description                                                    |
| :------------------- | :-------------- | :------------------------------------------------------------- |
| `id`                 | `String (cuid)` | Unique pity tracker ID                                         |
| `userId`             | `String`        | Discord user ID                                                |
| `bannerId`           | `String`        | Target banner ID                                               |
| `pityCount`          | `Int`           | Consecutive pulls without qualifying rarity                    |
| `guaranteedFeatured` | `Boolean`       | True if next target rarity is guaranteed featured (50/50 rule) |
| `lastPulledAt`       | `DateTime`      | Timestamp of most recent pull                                  |

### 3.3 `PokemonAcquisition`

Auditable, immutable ledger of all companion summons.

| Field              | Type              | Description                                |
| :----------------- | :---------------- | :----------------------------------------- |
| `id`               | `String (cuid)`   | Unique acquisition ID                      |
| `userId`           | `String`          | Authenticated participant ID               |
| `bannerId`         | `String`          | Banner summoned from                       |
| `bannerVersion`    | `Int`             | Configuration version at pull time         |
| `speciesId`        | `String`          | Acquired species ID                        |
| `gameplayRarity`   | `PokemonRarity`   | Authoritative HoldMeToIt gameplay rarity   |
| `isFeatured`       | `Boolean`         | Whether companion was featured on banner   |
| `pullCost`         | `Int`             | Coins deducted for this acquisition        |
| `ledgerTxId`       | `String`          | Reference to immutable `LedgerTransaction` |
| `pityCountBefore`  | `Int`             | Pity count prior to pull                   |
| `pityCountAfter`   | `Int`             | Pity count after pull commitment           |
| `pityTriggered`    | `Boolean`         | True if hard pity guaranteed this result   |
| `isDuplicate`      | `Boolean`         | True if user already owned this species    |
| `duplicateOutcome` | `String?`         | E.g. `OWNERSHIP_COUNT_INCREMENTED`         |
| `idempotencyKey`   | `String (unique)` | Request idempotency token                  |
| `createdAt`        | `DateTime`        | Acquisition timestamp                      |

---

## 4. Probability & Pity Mechanics

### 4.1 Basis Points Representation

Probabilities are specified in integer basis points (bps) where:
$$10,000\text{ bps} = 100.00\%$$
$$1\text{ bps} = 0.01\%$$

Standard Reference Rates (Balanced Configuration):

- **Normal:** 6,000 bps (60.00%)
- **Uncommon:** 2,500 bps (25.00%)
- **Rare:** 1,000 bps (10.00%)
- **Epic:** 400 bps (4.00%)
- **Legendary:** 90 bps (0.90%)
- **Mythical:** 10 bps (0.10%)
- **Total:** 10,000 bps (100.00%)

### 4.2 Cryptographic Randomness (CSPRNG)

Pulls use Node.js `crypto.randomInt(0, 10000)` instead of `Math.random()`. The random source is injected via a `RandomSource` function type `(max: number) => number`, allowing 100% deterministic unit testing without compromising production randomness.

### 4.3 Pity Engine Rules

- **Increment:** Each pull that fails to produce a qualifying reset rarity increments `pityCount` by 1.
- **Hard Pity Guarantee:** When `pityCount + 1 >= hardPityThreshold`, `targetRarity` is guaranteed on the current pull without rolling lower rarities.
- **Reset:** If the acquired companion's rarity is in `resetRarities` (or hard pity activates), `pityCount` resets to 0.
- **50/50 Featured Guarantee:** If `featuredGuarantee: true` is configured and the target rarity is rolled:
   - If `guaranteedFeatured: true`, the featured companion is guaranteed, resetting `guaranteedFeatured` to false.
   - If `guaranteedFeatured: false`, a 50/50 roll occurs. If lost, `guaranteedFeatured` becomes true for the next qualifying pull.

---

## 5. Duplicate Handling Policy

Phase 3 establishes that a user's collection is represented by `UserPokemon` records, with total ownership per species computed dynamically. When an already-owned species is pulled:

1. A new `UserPokemon` record is inserted with `isDuplicate: true` and `source: "GACHA"`.
2. The acquisition audit logs `duplicateOutcome: "OWNERSHIP_COUNT_INCREMENTED"`.
3. In the user's Pokédex and Collection views, the species count displays $N+1$ without violating database unique constraints.
4. No artificial currencies or discarded pulls occur.

---

## 6. Cinematic Reveal UI & Accessibility

The `PokemonRevealModal` presents a 3-stage visual sequence:

1. **Stage A/B — Anticipation:** Centered Pokéball energy orb with pulsing aura and dashed orbit rings.
2. **Stage C — Flash Burst:** Radial energy burst matching the gameplay rarity color.
3. **Stage D/E — Result Details:** Pokémon artwork, National Pokédex number, name, typing, rarity badge, duplicate tag, and coin ledger summary.

### Accessibility & Reduced Motion

- **Visible Skip Control:** A dedicated "Skip Reveal" button (`data-testid="skip-reveal-button"`) allows immediate progression to the details stage. Skipping never alters or refunds the committed server result.
- **`prefers-reduced-motion`:** Automatically skips dramatic spinning and scaling animations, landing instantly on the result details.
- **Keyboard Navigation:** Pressing `Escape` cleanly dismisses the completed modal.
- **Fallback Artwork:** If artwork fails to load or the source URL is null, a high-resolution Pokédex SVG Pokéball renders gracefully.

---

## 7. Administrative Controls

Administration is gated strictly by `requireAdminUser()`. Hosts can:

- View all active, draft, paused, and ended banners.
- Create draft banners with validated pull costs, hard pity thresholds, and basis-point rates.
- Transition banner statuses (`ACTIVE`, `PAUSED`, `ENDED`, `DISABLED`).
- Ensure no active banner operates without a verified configuration.
