# Identity — Platform Usernames & Identity Unification

> **Authority:** `AGENTS.md` Law L1 (Single Entity & Mathematical Unity), Law L4 (Discord Identity Primacy), Law L7 (Pure Domain Isolation), Law L9 (Zero-State & Error Resilience)  
> **Feature Specifications:** `FEATURES.md` (Scholar Profiles, Scoreboards)  
> **Feature Flag:** `platform_username` (`FEATURE_FLAG_KEYS.platformUsername`)  
> **Database Migration:** `20261105000000_user_username_ci_unique`  
> **Primary Layers:** `packages/database/`, `apps/web/features/auth/`, `apps/web/features/participant-stats/`, `apps/web/features/leaderboard/`, `apps/web/features/trophies/`, `apps/web/features/study-logs/`, `apps/web/components/ui/`

---

## 1. Executive Summary & Scope

Historically, scholars on HoldMeToIt were identified primarily by their Discord display name, with their Discord handle displayed on a secondary sub-line as `@username`. This caused visual redundancy across profile cards, scoreboards, and header capsules.

The **Platform Username** feature introduces unified, editable platform usernames with:

1. **Case-Preserving Storage with Case-Insensitive Uniqueness:** Stored exactly as typed by the scholar, but enforced globally unique via a PostgreSQL expression index `LOWER(username)`.
2. **7-Day Cooldown Protection:** Scholars can edit their platform username once every 7 days (`usernameChangedAt DateTime?`), preventing impersonation churn.
3. **Safe Rollout behind Feature Flag:** All username editing and availability checking is guarded behind the `platform_username` feature flag.
4. **Complete UI Identity Unification:** Eliminates duplicate display names and separate `@username` sub-lines across User Profiles, Challenge Leaderboards, Trophy Leaderboards, Home Cockpit Welcome banners, and Global Header Capsules.
5. **Trophy Badge Gating:** Gated the profile `Recruit (0 trophies)` badge behind the `global_leaderboard` feature flag.

---

## 2. Architecture & Domain Invariants

```mermaid
flowchart TD
    User([User in Profile]) -->|Clicks Pencil Icon| Dialog[EditUsernameDialog]
    Dialog -->|Debounced Check| ActionCheck[checkUsernameAvailabilityAction]
    ActionCheck -->|Flag & Syntax Check| DomainValidation[features/auth/domain/username.ts]
    ActionCheck -->|DB Query| RepoAvailability[user.repository.ts#isUsernameAvailable]
    Dialog -->|Submits New Name| ActionUpdate[updateUsernameAction]
    ActionUpdate -->|Feature Flag Gate| FlagCheck{platform_username Enabled?}
    FlagCheck -- No --> RejectFlag[Error: Feature Disabled]
    FlagCheck -- Yes --> AuthCheck{Session Authenticated?}
    AuthCheck -- No --> RejectAuth[Error: Authentication Required]
    AuthCheck -- Yes --> CooldownCheck{7-Day Cooldown Active?}
    CooldownCheck -- Yes --> RejectCooldown[Error: Cooldown Active]
    CooldownCheck -- No --> UpdateDB[user.repository.ts#updateUsername]
    UpdateDB --> AuditLog[Audit Log: USERNAME_UPDATED]
    UpdateDB --> ToastSuccess[Sonner Toast & Optimistic UI Refresh]
```

### 2.1 Pure Domain Rules (`features/auth/domain/username.ts`)

- **Syntax & Constraints:**
   - Length: 3 to 20 characters (`USERNAME_MIN_LENGTH = 3`, `USERNAME_MAX_LENGTH = 20`).
   - Allowed characters: Alphanumeric ASCII characters (`a-z`, `A-Z`, `0-9`) and single underscores (`_`).
   - Regex: `USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|_(?![_]))*[a-zA-Z0-9]$/`.
   - Underscore validation: Cannot start or end with an underscore (`USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE`), and no consecutive underscores `__` (`USERNAME_CONSECUTIVE_UNDERSCORES`).
- **Reserved Keywords Blacklist (`RESERVED_USERNAMES`):**
   - 48 case-insensitively prohibited reserved keywords:
     `admin`, `api`, `audit`, `auth`, `betting`, `challenge`, `challenges`, `changelog`, `dashboard`, `dev`, `docs`, `favicon`, `feedback`, `help`, `holdmetoit`, `host`, `leaderboard`, `login`, `logout`, `me`, `null`, `offline`, `pokemon`, `preferences`, `privacy`, `profile`, `public`, `rewards`, `robots`, `root`, `settings`, `sick`, `signin`, `signout`, `sitemap`, `static`, `status`, `support`, `system`, `task`, `tasks`, `team`, `teams`, `terms`, `trophies`, `u`, `undefined`, `user`, `users`, `wager`, `wagers`, `wrapped`, `ypt`.
   - Evaluated case-insensitively via `isReservedUsername(candidate)`.
- **7-Day Cooldown Engine:**
   - `USERNAME_COOLDOWN_DAYS = 7`, `USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000`.
   - `isUsernameChangeAllowed(lastChangedAt, now)`: Returns a `UsernameCooldownCheck` object `{ allowed: boolean, remainingDays: number, cooldownEndsAt: Date | null }`. Returns `{ allowed: true, remainingDays: 0, cooldownEndsAt: null }` if `lastChangedAt` is null/undefined or if $\ge 7\text{ days}$ have elapsed.
- **Domain Exports & Helper Functions:**
   - `validateUsername(candidate: unknown): UsernameValidationResult`: Validates candidate string and returns `{ ok: true, formatted: string, canonical: string }` or `{ ok: false, code: UsernameErrorCode, message: string }`.
   - `formatUsername(raw: string): string`: Trims outer whitespace while preserving user casing.
   - `canonicalizeUsername(raw: string): string`: Trims and lowercases for indexing and equality lookups.
   - `sanitizeDiscordUsername(rawDiscordUsername: string | null | undefined): string`: Sanitizes arbitrary Discord handles into compliant candidates (replaces non-alphanumeric chars with single underscores, trims underscores, clamps length to 3–20, resolves reserved keywords, defaults to `"scholar"`).
   - `generateSuffixedUsername(base: string, attempt: number): string`: Generates suffixed alternative (e.g. `base_1`), ensuring the final string never exceeds `USERNAME_MAX_LENGTH = 20`.
   - `usernameZodSchema`: Runtime Zod schema `z.string().min(1, ...).superRefine(...)` transforming valid input with `formatUsername(val)`.

---

## 3. Database & Data Integrity

### 3.1 Migration `20261105000000_user_username_ci_unique`

PostgreSQL enforces uniqueness case-insensitively using a partial expression index:

```sql
-- Verify no case-insensitive duplicate usernames exist before creating unique index
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT LOWER("username")
        FROM "User"
        WHERE "username" IS NOT NULL
        GROUP BY LOWER("username")
        HAVING COUNT(*) > 1
    ) sub;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Cannot create unique index "User_lower_username_key": found % case-insensitive duplicate username group(s). Run "npx tsx scripts/dedupe-usernames.ts --apply" before deploying this migration.', duplicate_count;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_lower_username_key"
ON "User" (LOWER("username"))
WHERE "username" IS NOT NULL;
```

This guarantees:

- Automated pre-check fails fast if duplicate non-null usernames exist, pointing operators to the deduplication script.
- `Alice` and `alice` cannot coexist (no spoofing or handle hijacking).
- `User.username` stores the exact casing desired by the scholar (`Afnan_Prime`).
- `User.usernameChangedAt` tracks timestamp of last change to enforce the 7-day cooldown.

### 3.2 Pre-Migration Deduplication Script (`apps/web/scripts/dedupe-usernames.ts`)

For existing databases with legacy conflicting Discord handles, a dry-run/apply CLI script identifies duplicates on `LOWER(username)` and safely appends `_1`, `_2` deterministically. Uses the shared `@holdmetoit/database` client and exact case-normalized comparisons.

---

## 4. API & Server Actions

### 4.1 `checkUsernameAvailabilityAction(candidate: string)`

- Returns `Promise<ServerActionResult<CheckUsernameResult>>`.
- `CheckUsernameResult`: `{ available: boolean, candidate: string, canonical: string, reason?: string }`.
- Gated behind `FEATURE_FLAG_KEYS.platformUsername`.
- Returns `{ ok: true, data: { available: false, ..., reason: validation.message } }` on syntax validation errors.
- Returns `available: true` if the candidate matches the caller's own current username.

### 4.2 `updateUsernameAction(newUsername: string)`

- Returns `Promise<ServerActionResult<UpdateUsernameResult>>`.
- `UpdateUsernameResult`: `{ username: string, usernameChangedAt: string }`.
- Enforces authentication (`requireSessionUser()`).
- Evaluates `platform_username` feature flag.
- Validates syntax and reserved word blacklist via `validateUsername()`.
- Asserts 7-day cooldown via `isUsernameChangeAllowed()`.
- Atomically updates `username` and sets `usernameChangedAt = new Date()`.
- Emits audit log event with `actionType: "USERNAME_UPDATED"`.
- Revalidates paths: `revalidatePath("/profile")` and `revalidatePath("/")`.

---

## 5. Presentation Layer & UI Unification

### 5.1 Profile Header (`features/participant-stats/presentation/global-profile-view.tsx`)

- **Single Unified Scholar Name:** Line 1 displays `currentUsername || user.displayName`.
- **Pencil Edit Trigger:** `<EditUsernameDialog currentUsername={...} usernameChangedAt={...} />` renders adjacent to the username only when `isOwnProfile && isPlatformUsernameEnabled`.
- **Trophy Rank Gating:** The `Recruit (0 trophies)` badge (`TrophyRoleBadge`) is wrapped in `{isGlobalLeaderboardEnabled && (...) }`, preventing clutter until competitive trophies rollout.
- **Removed Duplicate Handle:** Obsolete separate `<p className="...">@{user.username}</p>` sub-line removed.

### 5.2 Edit Username Modal (`features/auth/presentation/edit-username-dialog.tsx`)

- Radix Dialog triggered by an Obsidian pencil button.
- Real-time debounced availability check showing green checkmark or red conflict error.
- Displays 7-day cooldown rules and remaining days if on cooldown.
- Pending spinner and transition feedback; automatically updates UI and closes dialog on success.

### 5.3 Challenge Leaderboard (`features/leaderboard/presentation/challenge-leaderboard-tab.tsx`)

- **Podiums (Rank 1, 2, 3):** Renders `{top.username || top.displayName}`.
- **Main Standings Table (Desktop & Mobile):**
   - Line 1: Primary link renders `{entry.username || entry.displayName}`.
   - Line 2: Removed redundant `@username` text; cleanly hosts `SickStatusBadge` and `PaceBadge`.
- **Unassigned Scholars Table:** Renders `{entry.username || entry.displayName}` and removes duplicate handle line.
- **Flat List & Team Roster Cards:** Renders `{entry.username || entry.displayName}` with no duplicate `@username` line.

### 5.4 Global Trophy Leaderboard (`features/trophies/presentation/trophy-leaderboard-view.tsx`)

- Row header displays `{entry.username || entry.displayName}`.
- Meta subline removes redundant `@{entry.username}` and cleanly displays career record: `{wins}W / {losses}L ({winRate}%)`.

### 5.5 Home Cockpit & Global Navigation

- **Home Cockpit (`home-cockpit-view.tsx`):**
   - `effectiveDisplayName` prioritizes `user?.username || cockpit?.participant.username`.
   - Renders "Welcome `{username}`" with link to scholar profile.
- **Global Header Capsule (`components/ui/header.tsx`):**
   - Prioritizes `user.username || user.displayName || user.name || "Companion"`.

---

## 6. Verification & Quality Gates

| Test Suite                                              | Scope                                           | Status |
| :------------------------------------------------------ | :---------------------------------------------- | :----- |
| `features/auth/domain/username.test.ts`                 | Syntax, normalization, 7-day cooldown, Zod      | Pass   |
| `features/auth/data/user.repository.test.ts`            | DB queries, CI unique lookups, updates          | Pass   |
| `features/auth/api/username.actions.test.ts`            | Flag gating, cooldown rejection, audit logs     | Pass   |
| `features/auth/presentation/edit-username-dialog.test.` | Modal rendering, availability check, save flows | Pass   |
| `features/participant-stats/.../global-profile-view.`   | Header name, pencil toggle, trophy flag gating  | Pass   |
| `features/leaderboard/.../challenge-leaderboard-tab.`   | Podiums, table rows, mobile cards, team view    | Pass   |
| `features/trophies/.../trophy-leaderboard-view.`        | Row title, record line, pagination              | Pass   |
| `features/study-logs/.../home-cockpit-view.`            | Welcome header link username prioritization     | Pass   |
| `components/ui/header.test.tsx`                         | User capsule username prioritization            | Pass   |
