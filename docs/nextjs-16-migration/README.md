# Next.js 14 → 16 Migration & Security Upgrade Plan

> **Scope:** `apps/web` (Next.js App Router) plus the shared workspace packages and CI tooling that gate it.
> **Driving ticket:** `SECURITY.md` **SEC-02** — outdated Next.js with 1 critical + 4 high advisories.
> **Baseline commit:** `fb04ccb` (branch `afnan-jr`), typecheck exit `0`.
> **Target:** `next@16.4.5`, `react@19.3.x`, `react-dom@19.3.x`, `eslint@9.39.x`, `eslint-config-next@16.4.5`.
> **Last Updated:** 2026-11-04
> **Authority:** `AGENTS.md` §6 (locked stack), §7 (stack laws), §9 (quality gates). This document does **not** override `FEATURES.md` or `DESIGN.md`.
>
> **Revision (2026-11-04):** Target is now `next@16.4.5`. The in-memory rate limiter was removed (serverless per-instance counters are ineffective), so the `headers()` migration is gone and only `cookies()` remains. See §5.1, §5.6, and §9.

---

## 1. Executive Summary

This is a **two-major upgrade**: `next@14.2.35` → `next@16.4.5`. Next.js 15 removed synchronous access to request APIs (temporarily) and Next.js 16 removed the compatibility shim entirely, so the async migration is unavoidable. The project is in a good position because most `cookies()` calls are already awaited and there are no Pages Router, AMP, legacy `next/image`, parallel-route, or metadata-image routes to migrate.

**Verdict:** the upgrade is feasible in one PR, but it touches **8 application surfaces + 1 config file + tooling**. The work is mechanical except for three risk areas: Auth.js session handling through the new `proxy` convention, Turbopack as the default bundler with `discord.js`, and cache invalidation semantics (`revalidateTag` now requires a second argument).

### Change counts (current tree)

| Category                                | Count | Blocker? |
| :-------------------------------------- | ----: | :------- |
| Page files with sync `params`           |     3 | **Yes**  |
| Page files with sync `searchParams`     |     8 | **Yes**  |
| Sync `cookies()` calls                  |     1 | **Yes**  |
| Single-argument `revalidateTag()`       |     1 | **Yes**  |
| `next.config` keys removed/renamed      |     3 | **Yes**  |
| `middleware.ts` → `proxy.ts`            |     2 | **Yes**  |
| `next lint` script + legacy ESLint      |     2 | **Yes**  |
| React 19 type fixes (wrappers, tests)   |     4 | No       |
| Test files needing prop fixture updates |     6 | **Yes**  |
| DB schema / Prisma migrations           |     0 | N/A      |

### Security outcome

- **Next.js:** 14.2.35 is the **last 14.x release**; there is no patched 14.x. `npm audit` reports `next` as **critical** with a fix only at `16.4.5`.
- Upgrading to `16.4.5` clears the `next` and nested `postcss` advisories (including the SVG Image Optimizer RCE and the Server Actions DoS).
- **Not cleared by this upgrade:** `prisma`, `@prisma/config`, and `deepmerge-ts`. Those need a separate **Prisma 7.10.1+** major upgrade. Do not conflate the two.

---

## 2. Diagnosis Snapshot

### 2.1 Installed vs declared

| Package              | Declared range   | Installed       | Target       | Notes                                             |
| :------------------- | :--------------- | :-------------- | :----------- | :------------------------------------------------ |
| `next`               | `^14.2.28`       | `14.2.35`       | `16.4.5`     | 14.2.35 is the end of the 14.x line               |
| `react`              | `^18.3.1`        | `18.3.1`        | `19.3.x`     | Next 16 requires React 19.2+                      |
| `react-dom`          | `^18.3.1`        | `18.3.1`        | `19.3.x`     | —                                                 |
| `@types/react`       | `^18.3.23`       | `18.3.23`       | `19.3.0`     | Required for React 19 types                       |
| `@types/react-dom`   | `^18.3.7`        | `18.3.7`        | `19.3.0`     | —                                                 |
| `eslint`             | `^8.57.1`        | `8.57.1`        | `9.39.5`     | ESLint 8 is EOL; `eslint-config-next@16` needs 9+ |
| `eslint-config-next` | `^14.2.28`       | `14.2.28`       | `16.4.5`     | Now flat-config-first                             |
| `next-auth`          | `^5.0.0-beta.28` | `5.0.0-beta.32` | keep beta.32 | Peer range already allows `next@^16`              |
| `sharp`              | `^0.35.5`        | `0.35.5`        | keep         | Meets the SVG-RCE workaround (`>=0.35.5`)         |
| Node.js              | `>=22.12.0`      | `22.23.4`       | keep         | Next 16 min is `20.9.0`                           |
| TypeScript           | `^5.8.3`         | `5.8.3`         | keep         | Next 16 min is `5.1.0`                            |

> **Node engine caution:** ESLint **9** works on Node 22.12. ESLint **10** requires Node `^22.13.0`. Keep ESLint 9 unless we also raise the repo engine.

### 2.2 Current quality gates

`apps/web` typecheck is green at the baseline commit (`npx tsc --noEmit` → exit `0`). Tests and build were not re-run for this diagnosis; CI is the source of truth for the pre-upgrade state.

### 2.3 Current `npm audit --omit=dev`

| Package          | Severity     | Fix path                      |
| :--------------- | :----------- | :---------------------------- |
| `next`           | **critical** | `16.4.5`                      |
| `postcss`        | high         | `16.4.5` (nested in `next`)   |
| `@prisma/config` | high         | Prisma `7.10.1+` (separate)   |
| `deepmerge-ts`   | high         | `deepmerge-ts@8` (via Prisma) |
| `prisma`         | high         | Prisma `7.10.1+` (separate)   |

The newest Next.js advisories (`GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`) are fixed in **`15.5.28` and `16.4.1`**. However, `npm audit` only offers `next@16.4.5` as the fix for this tree, so a `15.5.28` stopgap is **not** a permanent closure. Go to `16.4.5`.

---

## 3. Target Version Matrix

| Layer        | Package                            | Target          | Why                                                             |
| :----------- | :--------------------------------- | :-------------- | :-------------------------------------------------------------- |
| Framework    | `next`                             | `16.4.5`        | Latest stable; clears Next advisories                           |
| UI runtime   | `react`, `react-dom`               | `19.3.x`        | Required by Next 16; all React-dependent deps support 19        |
| Types        | `@types/react`, `@types/react-dom` | `19.3.0`        | React 19 type changes (`useRef` arg, ref cleanups, `React.JSX`) |
| Lint         | `eslint`                           | `9.39.5`        | `eslint-config-next@16` peer is `>=9`                           |
| Lint config  | `eslint-config-next`               | `16.4.5`        | Flat config; matches framework version                          |
| Lint/format  | `eslint-config-prettier`           | `10.1.8`        | Already installed; use the `/flat` entry point                  |
| Auth         | `next-auth`                        | `5.0.0-beta.32` | Already installed; peer supports `next@^16`, `react@^19`        |
| Auth adapter | `@auth/prisma-adapter`             | `2.x`           | No change needed                                                |

All checked React peers (Radix packages, `cmdk`, `lucide-react`, `logrocket-react`, `sonner`, `@testing-library/react`) already accept `react@^19`. No peer blocker found.

---

## 4. Recommended Upgrade Strategy

### Option A — Direct 14 → 16 (recommended)

Do the framework jump in one branch, but execute it in **three commits** (tooling, framework/code, cleanup) so review is tractable. This is preferred because Next.js 15 is only a waypoint and a `15.5.28` stopgap still leaves `npm audit` unhappy.

### Option B — Staged 14 → 15.5.28 → 16.4.5

Useful if we want a production soak between majors. Cost: two full CI cycles, two Vercel deploys, and `15.5.28` does not close the audit entry. Only choose this if the team needs a rollback point at 15.

### Branching & issue lifecycle (per `AGENTS.md` §4)

```text
chore/nextjs-16-upgrade  →  dev  →  main
```

Jira/GitHub flow: `To Do` → `In Progress` (branch created) → `In Review` (PR to `dev`, all gates green) → `Done` (after merge + release PR to `main`). Do not mark the issue `Done` when the PR opens.

---

## 5. P0 — Blocking Changes (must land before the app runs on 16)

### 5.1 Async Request APIs (`params`, `searchParams`, `cookies`)

Next 16 removes synchronous access completely. `cookies()` must be awaited, and `params`/`searchParams` are Promises in pages, layouts, route handlers, `generateMetadata`, and generated metadata image routes.

> **Rate-limiter revision (2026-11-04):** the in-memory limiter and its `headers()` call were removed instead of migrated. After that change, `preview-mode.actions.ts` is the only synchronous request API left.

#### 5.1.1 Sync `cookies()`

| File                                                 | Line | Current                          | Fix                                    |
| :--------------------------------------------------- | ---: | :------------------------------- | :------------------------------------- |
| `apps/web/features/auth/api/preview-mode.actions.ts` |   21 | `const cookieStore = cookies();` | `const cookieStore = await cookies();` |

> The rest of the app already awaits `cookies()` (`app/layout.tsx`, `app/page.tsx`, `app/admin/layout.tsx`, etc.). Do not “fix” already-async calls.

#### 5.1.2 Pages with synchronous `params` / `searchParams`

| File                                                               | Props today                    | Required change                                    |
| :----------------------------------------------------------------- | :----------------------------- | :------------------------------------------------- |
| `apps/web/app/page.tsx`                                            | sync `searchParams`            | `Promise<...>`, await once at top                  |
| `apps/web/app/challenge/[id]/page.tsx`                             | sync `params` + `searchParams` | Promise + await in page **and** `generateMetadata` |
| `apps/web/app/challenge/[id]/participant/[participantId]/page.tsx` | sync `params` + `searchParams` | Promise + await in page **and** `generateMetadata` |
| `apps/web/app/profile/[userId]/page.tsx`                           | sync `params` + `searchParams` | Promise + await in page **and** `generateMetadata` |
| `apps/web/app/profile/page.tsx`                                    | sync `searchParams`            | Promise + await                                    |
| `apps/web/app/wallet/page.tsx`                                     | sync `searchParams`            | Promise + await                                    |
| `apps/web/app/pokemon/page.tsx`                                    | sync `searchParams`            | Promise + await                                    |
| `apps/web/app/devboard/page.tsx`                                   | sync `searchParams`            | Promise + await                                    |

The canonical rewrite (applies to every page above):

```ts
interface ChallengePageProps {
   params: Promise<{ id: string }>;
   searchParams?: Promise<{
      tab?: string;
      as?: string;
      view?: string;
      search?: string;
      team?: string;
      page?: string;
   }>;
}

export async function generateMetadata({
   params,
}: ChallengePageProps): Promise<Metadata> {
   const { id } = await params;
   // ...
}

export default async function ChallengePage({
   params,
   searchParams,
}: ChallengePageProps) {
   const { id } = await params;
   const query = (await searchParams) ?? {};

   // replace params.id            -> id
   // replace searchParams?.tab    -> query.tab
   // replace searchParams?.as     -> query.as
   // ...
}
```

For pages that only receive `searchParams`, `const { as } = (await searchParams) ?? {};` is enough. `await undefined` is valid, so tests can keep omitting the prop.

#### 5.1.3 Tests

Six test files construct page props synchronously and must pass Promises:

- `apps/web/app/page.test.tsx`
- `apps/web/app/challenge/[id]/page.test.tsx`
- `apps/web/app/challenge/[id]/participant/[participantId]/page.test.tsx`
- `apps/web/app/profile/[userId]/page.test.tsx`
- `apps/web/app/profile/page.test.tsx`
- `apps/web/app/devboard/page.test.tsx`

```ts
// before
await ChallengePage({
   params: { id: "chal-1" },
   searchParams: { tab: "leaderboard" },
});

// after
await ChallengePage({
   params: Promise.resolve({ id: "chal-1" }),
   searchParams: Promise.resolve({ tab: "leaderboard" }),
});
```

The `next-async-request-api` codemod can rewrite production code, but **review test fixtures manually** — the codemod often leaves `Promise.resolve` wrappers or `UnsafeUnwrapped*` casts behind. Do not commit `UnsafeUnwrappedCookies`/`UnsafeUnwrappedHeaders` shims; Next 16 no longer supports them.

---

### 5.2 `revalidateTag()` now requires a cache-life argument

`revalidateTag(tag)` is deprecated in Next 16 and produces a TypeScript error. The current helper is:

`apps/web/core/cache/index.ts:35-38`

```ts
// before
export function invalidateTags(tags: readonly string[]): void {
   for (const tag of tags) {
      revalidateTag(tag);
   }
}

// after — preserves today's immediate invalidation semantics
export function invalidateTags(tags: readonly string[]): void {
   for (const tag of tags) {
      revalidateTag(tag, { expire: 0 });
   }
}
```

Why `{ expire: 0 }`: the single-argument form behaved like `{ expire: 0 }`. The helper is called from **both** Server Actions and the `/api/tasks/sync` Route Handler, so `updateTag()` (Server-Action-only) is not a drop-in replacement. Using `"max"` would silently switch the app to stale-while-revalidate, which is a product behavior change for leaderboards and the cockpit.

Update `apps/web/core/cache/index.test.ts` accordingly:

```ts
expect(revalidateTag).toHaveBeenNthCalledWith(1, "tag:one", { expire: 0 });
expect(revalidateTag).toHaveBeenNthCalledWith(2, "tag:two", { expire: 0 });
```

> `unstable_cache()` still exists in Next 16, but it is officially replaced by the `use cache` directive. **Do not** migrate to `use cache` in this PR — that requires enabling `cacheComponents` and reworking uncached data boundaries. Track it separately (see §7).

---

### 5.3 `next.config.mjs` — removed and renamed keys

File: `apps/web/next.config.mjs`

| Key today                                               | Status in Next 16                           | Action                              |
| :------------------------------------------------------ | :------------------------------------------ | :---------------------------------- |
| `eslint: { dirs: [...] }`                               | **Removed** (config option and `next lint`) | Delete the block                    |
| `experimental.outputFileTracingIncludes`                | Stable; **top-level**                       | Move to `outputFileTracingIncludes` |
| `experimental.serverComponentsExternalPackages`         | Renamed in 15; **top-level**                | Move to `serverExternalPackages`    |
| `experimental.serverActions.bodySizeLimit`              | Still valid under `experimental`            | Keep as-is                          |
| `reactStrictMode`, `redirects`, `images.remotePatterns` | Unchanged                                   | Keep as-is                          |

Resulting shape:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
   reactStrictMode: true,
   experimental: {
      serverActions: {
         // 3 MB punishment image + multipart overhead (Vercel caps requests at 4.5 MB).
         bodySizeLimit: "4mb",
      },
   },
   // discord.js ships undici/ws-backed runtime code; keep it out of the
   // server bundle and resolve it from node_modules instead.
   serverExternalPackages: ["@holdmetoit/discord", "discord.js"],
   // Ship the changelog source with the serverless function so the dynamic
   // /changelog route can read it at runtime.
   outputFileTracingIncludes: {
      "/changelog": ["../../CHANGELOG.md"],
   },
   // ...redirects(), images...
};
```

**Changelog tracing risk (verify, don't assume):** `apps/web/features/changelog/data/changelog.repository.ts` reads `CHANGELOG.md` from `process.cwd()` and `../../CHANGELOG.md`. Under Turbopack + a monorepo, tracing from the app root may not include a file outside `apps/web`. After `next build`, verify the deployed `/changelog` renders entries. If it renders empty:

1. Prefer moving/copying the changelog into the app (e.g. `apps/web/CHANGELOG.md`).
2. Or set `outputFileTracingRoot` to the repo root and keep the include path — but expect a larger trace, so measure first.

Do not add `outputFileTracingRoot` blindly; it changes tracing scope for every route.

`apps/web/next.config.test.ts` only asserts `redirects()` and continues to work. Add a small assertion for the config shape if desired.

---

### 5.4 `middleware.ts` → `proxy.ts`

Next 16 renames the network boundary from `middleware` to `proxy`. `middleware` is deprecated; `proxy` runs on the **Node.js runtime** (edge is not supported for `proxy`).

Current `apps/web/middleware.ts` uses only `NextRequest`, `NextResponse`, `request.cookies`, `request.nextUrl`, and `process.env` — all Node-compatible, so a rename is safe.

```ts
// apps/web/proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
   // body unchanged
}

export const config = {
   matcher: ["/admin/:path*", "/devboard/:path*", "/profile"],
};
```

Also:

- Rename `apps/web/middleware.test.ts` → `apps/web/proxy.test.ts`; import `{ proxy, config }` and call `proxy(request)`.
- No `export const runtime = "edge"` exists, so no runtime conflict.
- If we ever need edge-only behavior, keep `middleware.ts` instead — but our cookie gate does not need edge.
- Config flags `skipMiddlewareUrlNormalize` are not used here; if introduced later, rename to `skipProxyUrlNormalize`.

---

### 5.5 `next lint` removal → ESLint CLI + flat config

Next 16 removes `next lint` and the `eslint` key in `next.config`. `next build` no longer runs linting, so lint must be an explicit CI step (it already is).

#### 5.5.1 Scripts

`apps/web/package.json:12`

```diff
- "lint": "next lint --dir app --dir components --dir features --dir core --dir lib",
+ "lint": "eslint app components core features lib types",
```

Keep the same directory scope initially so the flat-config migration does not suddenly lint `scripts/`, `prototype/`, or JSON fixtures.

#### 5.5.2 Dependencies

```bash
npm install -D eslint@9.39.5 eslint-config-next@16.4.5 -w @holdmetoit/web
```

`eslint-config-prettier@10.1.8` stays. Use `eslint-config-prettier/flat` in the new config.

#### 5.5.3 Add `eslint.config.mjs`, delete `.eslintrc.json`

`apps/web/eslint.config.mjs` (port the existing custom token guards exactly):

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
   ...nextVitals,
   {
      rules: {
         "no-restricted-syntax": [
            "error",
            {
               selector:
                  "Literal[value=/\\b(?:bg|text|border|from|to|via|ring|shadow|fill|stroke|divide|outline|decoration|placeholder|caret|accent)-\\[#[0-9a-fA-F]{3,8}\\]/]",
               message:
                  "Raw hex colour: use a semantic/component token (DESIGN.md §2).",
            },
            {
               selector:
                  "JSXAttribute[name.name=/^(?:fill|stroke|color)$/] Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
               message:
                  "Raw hex in an SVG/style attribute: use var(--color-*) or currentColor.",
            },
            {
               selector: "Literal[value=/var\\(--primitive-/]",
               message:
                  "Primitive tokens are private: use a semantic/component token.",
            },
            {
               selector: "Literal[value=/\\bobsidian-[a-zA-Z0-9-]+/]",
               message:
                  "Legacy obsidian-* token removed: use a semantic token.",
            },
            {
               selector: "Literal[value=/\\btext-\\[[0-9.]+px\\]/]",
               message:
                  "Arbitrary font size: use a typography token (text-meta, text-label, text-caption, text-body, text-display-*).",
            },
            {
               selector:
                  "Literal[value=/(?:min-h|h|min-w|max-w)-\\[(?:44|50|74|170|200|240|400|620|840)px\\]/]",
               message:
                  "Arbitrary size: use a sizing token (control-sm/md/lg, dropdown-min, artwork-*, panel-*).",
            },
         ],
      },
   },
   prettier,
   globalIgnores([
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "prototype/**",
   ]),
]);
```

Notes:

- Do **not** add `eslint-config-next/typescript` in the same PR. It enables `typescript-eslint` recommended rules and can surface a large backlog. Add it as a separate, reviewed lint-hardening PR.
- ESLint 9 ignores `.eslintignore`; keep ignores in `globalIgnores`.
- Delete `apps/web/.eslintrc.json` only after `eslint` runs clean with the new config.

#### 5.5.4 CI

`.github/workflows/ci.yml` already runs `npm run lint -w @holdmetoit/web` in a separate step, so no workflow edit is required — but the command now executes `eslint` instead of `next lint`. Ensure `npm ci` installs the upgraded lockfile.

---

### 5.6 React 19 code impact

The codebase was audited for the React 19 breaking changes:

| React 19 breaking change                      | Found in repo                       | Action                      |
| :-------------------------------------------- | :---------------------------------- | :-------------------------- |
| `ReactDOM.render` / `hydrate` / `findDOMNode` | No                                  | None                        |
| `react-dom/test-utils` / `act`                | No                                  | None                        |
| `useFormState` → `useActionState`             | No                                  | None                        |
| `propTypes` / `defaultProps` on components    | No (test variables only)            | None                        |
| Legacy string refs / legacy context           | No                                  | None                        |
| Global `JSX` namespace usage                  | No                                  | None                        |
| `useRef()` with no argument                   | No                                  | None                        |
| Ref callback implicit returns                 | 6 callbacks, all block-bodied       | None                        |
| `useReducer<React.Reducer<...>>` generics     | No                                  | None                        |
| `ReactElement` props defaulting to `unknown`  | `challenge-images.test.tsx` helpers | Type as `ReactElement<any>` |
| `forwardRef` (deprecated, still supported)    | 82 usages                           | Optional follow-up          |

**Additional React 19 fixes applied during implementation:**

- `DialogContentProps` and `UserAvatarProps` are type aliases (`Base & { ... }`), not `interface extends React.ComponentPropsWithoutRef<...>`. React 19's conditional `ComponentPropsWithoutRef` loses members when extended through an interface or an intermediate type alias.
- `@types/react` and `@types/react-dom` are installed at the **repo root** so hoisted Radix declarations resolve React types instead of `any`; this also dedupes React/ReactDOM to one 19.3.1 copy.
- `challenge-images.test.tsx` traverses elements as `ReactElement<any>` because React 19 defaults `ReactElement.props` to `unknown`.
- The new React Hooks v6 rules in `eslint-config-next@16` (`set-state-in-effect`, `purity`, `refs`, `immutability`) are explicitly deferred in `eslint.config.mjs` with a follow-up.

**TypeScript caveats to expect after bumping `@types/react@19`:**

- `useRef` now requires an argument (`useRef(undefined)` if intentionally empty). None found today, but new code must follow this.
- Ref callbacks must not return a value. All six current callbacks use block bodies, so they are safe.
- JSX namespace augmentation must be scoped to `declare module "react"`. No global augmentation exists.
- `React.ElementRef` / `React.ComponentRef` are deprecated aliases but still type-check. `components/ui/*` uses `React.ElementRef` extensively; leave it for now.

Run the React codemod on a branch, review every hunk, then discard anything that changes behavior:

```bash
npx types-react-codemod@latest preset-19 ./apps/web
```

`forwardRef` → `ref`-as-prop is a **separate refactor**, not a migration blocker.

---

### 5.7 Turbopack is now the default bundler

Next 16 uses Turbopack for `next dev` **and** `next build`. The repo has **no custom `webpack` config**, so the “build fails when a webpack config is present” rule does not apply.

What still needs attention:

1. **Keep `serverExternalPackages: ["@holdmetoit/discord", "discord.js"]`.** `apps/web` imports `@holdmetoit/discord` in `features/auth`, `features/feedback`, and `features/wrapped` server code. Without this, Turbopack will try to bundle `discord.js`/undici/ws and can fail or bloat the server bundle.
2. **Prisma is auto-externalized** (`@prisma/client` and `prisma` are in Next's default external list). No extra config.
3. **`sharp@0.35.5` is installed.** It is in Next's external list and satisfies the Image Optimizer advisory workaround.
4. **Fallback if a real blocker appears:** `next build --webpack` / `next dev --webpack`. Do not mix bundlers between dev and prod without documenting it.
5. `experimental.turbo` is not used; if added later it must become top-level `turbopack`.

Scripts do **not** need `--turbopack`; leave `"dev": "next dev"` and `"build": "next build"` unchanged.

---

### 5.8 `next/image` behavior changes

No code change is strictly required, but these defaults change in 16:

| Change                                                         | Repo impact                                                                                                                                 |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `images.minimumCacheTTL` 60s → 4h                              | Discord avatar URLs are hash-suffixed, so cache keys change on update. Low risk. Set `minimumCacheTTL: 60` only if freshness becomes a bug. |
| `images.qualities` defaults to `[75]`                          | No `quality={...}` props exist. No action.                                                                                                  |
| `imageSizes` drops `16`                                        | Some `sizes="20px"` icons exist; 16px is only a candidate width. Visual check at 360px.                                                     |
| `images.maximumRedirects` unlimited → 3                        | Discord CDN / Supabase public URLs normally serve directly. Verify broken images in J5/J6.                                                  |
| Local images with query strings require `localPatterns.search` | No local `src` with `?` found. No action.                                                                                                   |
| `images.domains` deprecated/removed                            | Already using `remotePatterns`. No action.                                                                                                  |
| `next/legacy/image` deprecated                                 | Not used. No action.                                                                                                                        |

---

### 5.9 Package and lockfile changes

Edit the **workspace** `apps/web/package.json`, then run `npm install` at the repo root (never `npm install` inside `apps/web` alone — it breaks workspace hoisting and the lockfile).

```diff
"next": "^16.4.5",
"react": "^19.3.1",
"react-dom": "^19.3.1",
...
"@types/react": "^19.3.0",
"@types/react-dom": "^19.3.0",
"eslint": "^9.39.5",
"eslint-config-next": "^16.4.5",
```

Then:

```bash
npm install
npm ls next react react-dom eslint --depth=0
```

Commit the regenerated `package-lock.json`. The root `packageManager: "npm@12.2.0"` and `engines.node >=22.12.0` are fine.

---

## 6. P1 — Mechanical Follow-ups (same PR, but low-risk)

| Item                         | Detail                                                                                                                             |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| Regenerated `next-env.d.ts`  | Next 16 rewrites this tracked file. Commit the new content; do not hand-edit.                                                      |
| `tsconfig.json` auto-updates | Next may add/update generated type paths. Review the diff; keep `strict: true`.                                                    |
| `next typegen` (optional)    | Use generated `PageProps<'/route'>` / `LayoutProps` helpers if desired. Not required — the repo uses explicit interfaces.          |
| `.next/dev` output           | `next dev` now writes to `.next/dev`; `**/.next/` is already git-ignored.                                                          |
| Build output                 | Next 16 removes `size` / `First Load JS` from build logs. Measure with Lighthouse/Vercel Analytics instead.                        |
| `X-Powered-By`               | No change required; consider `poweredByHeader: false` separately.                                                                  |
| Footer/scroll behavior       | Next 16 no longer overrides `scroll-behavior`; no global `scroll-behavior: smooth` was found, so no `data-scroll-behavior` needed. |

---

## 7. Deprecations & Optional Modernization (do **not** bundle into this PR)

| Deprecation                                                        | Current usage                  | Recommendation                                                                                                           |
| :----------------------------------------------------------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `unstable_cache()` replaced by `use cache`                         | `apps/web/core/cache/index.ts` | Keep `unstable_cache` for now. Migrating requires `cacheComponents: true` and a full cached-data audit; separate ticket. |
| `forwardRef` deprecated                                            | 82 UI primitives               | Optional ref-as-prop migration. Mechanical but noisy; separate PR.                                                       |
| `React.ElementRef` alias                                           | `components/ui/*`              | Replace with `React.ComponentRef` during the `forwardRef` cleanup.                                                       |
| React Compiler (`reactCompiler: true`)                             | Not enabled                    | Do not enable during migration; measure build-time cost first.                                                           |
| Cache Components / PPR (`cacheComponents`)                         | Not enabled                    | Do not enable; it surfaces uncached-data build errors and needs a separate design pass.                                  |
| `experimental_ppr` route segment                                   | None                           | Removed in 16. No action.                                                                                                |
| `next lint`                                                        | Script only                    | Covered in §5.5.                                                                                                         |
| `next/legacy/image`                                                | None                           | Removed/deprecated. No action.                                                                                           |
| `images.domains`                                                   | None                           | Removed/deprecated. No action.                                                                                           |
| `serverRuntimeConfig` / `publicRuntimeConfig`                      | None                           | Removed in 16. No action.                                                                                                |
| `devIndicators.{appIsrStatus,buildActivity,buildActivityPosition}` | None                           | Removed in 16. No action.                                                                                                |
| `experimental.dynamicIO` / `experimental.useCache`                 | None                           | Removed in 16. No action.                                                                                                |
| `unstable_rootParams`                                              | None                           | Removed in 16. No action.                                                                                                |

---

## 8. Verified Non-Issues (explicitly audited, no change needed)

These were checked and are **not** present, so they should not appear in review comments:

- No Pages Router, no `pages/` directory, no `next/router`.
- No AMP config or `next/amp`.
- No `next/legacy/image`, `layout`/`objectFit`/`objectPosition` Image props, or `onLoadingComplete`.
- No `images.domains`.
- No parallel routes (`@slot`) and therefore no missing `default.js`.
- No `opengraph-image` / `twitter-image` / `icon` / `apple-icon` / `sitemap` route files (the async `params`/`id` changes for those don’t apply).
- No `generateStaticParams` (all dynamic routes are `force-dynamic`).
- No `runtime = "experimental-edge"`.
- No `NextRequest.ip` / `NextRequest.geo`.
- No `useFormState`, `ReactDOM.render`, `react-dom/test-utils`, `defaultProps` on components, string refs, legacy context, or global `JSX`.
- No `useRef()` with zero arguments.
- No `useReducer<React.Reducer<...>>` generics.
- No `next/script`, no custom `webpack` config, no `experimental.turbo`.
- No `serverRuntimeConfig` / `publicRuntimeConfig`.
- No `fetch(..., { cache: ... })` assumptions that depend on Next 14’s cached-by-default `fetch` (all network calls are request-time or explicitly dynamic).
- No GET Route Handlers relying on Next 14 caching (the only GET is Auth.js’s handler).
- No `images.localPatterns` need (no local image query strings).

---

## 9. Test Suite Impact

| Area               | Files                                                                                                                                                | Change                                                                                                                   |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| Async page props   | 6 `*.test.tsx` files listed in §5.1.3                                                                                                                | Wrap `params` / `searchParams` — and the `generateMetadata` `params` calls in the same files — in `Promise.resolve(...)` |
| `cookies()` mocks  | `app/page.test.tsx`, `app/challenge/[id]/page.test.tsx`, `app/admin/layout.test.tsx`, `app/devboard/layout.test.tsx`, `app/challenges/page.test.tsx` | Most already return resolved values; make sure every `cookies: vi.fn()` mock resolves to a store with `get()`.           |
| Cache invalidation | `core/cache/index.test.ts`, `features/study-logs/api/log-study-time.actions.test.ts`                                                                 | Assert two-argument `revalidateTag` calls.                                                                               |
| Proxy              | `middleware.test.ts` → `proxy.test.ts`                                                                                                               | Import `proxy`, call it directly.                                                                                        |
| React 19 runtime   | Full suite                                                                                                                                           | `renderToStaticMarkup` and Testing Library 16.3 are React 19-compatible. Re-run and fix only genuine failures.           |

Run:

```bash
npm run build -w @holdmetoit/database
npm run build -w @holdmetoit/discord
npm run test -w @holdmetoit/web
```

`apps/web/vitest.config.ts` needs no change (aliases and `oxc` JSX transform are version-agnostic).

---

## 10. Security Closure Notes

1. **Next.js:** upgrade to `16.4.5`. This closes the critical `next` advisory and the nested `postcss` advisory. The latest Image Optimizer SVG RCE and Server Actions DoS require `>=16.4.1`, so `16.4.5` is the correct floor — do not pin lower.
2. **`sharp`:** `0.35.5` is already installed and meets the advisory workaround (`>=0.35.5`). Keep it.
3. **`postcss`:** the direct dependency resolves to `8.5.29` (fixed). The vulnerable copy is nested under `next@14` and is removed by the framework upgrade.
4. **Prisma family (not fixed by this PR):** `prisma@6.19.3`, `@prisma/config`, and `deepmerge-ts@7.1.5` remain flagged. Fix requires **Prisma `7.10.1+`** and `deepmerge-ts@8`. Prisma 7 is a separate major with generator/config changes. Open a dedicated ticket and do not block the Next upgrade on it.
5. **Re-run after merge:** `npm audit --omit=dev` should show **0** `next`/`postcss` findings. Update `SECURITY.md` SEC-02 with the new version and remaining Prisma findings.
6. **Auth.js is beta** (`5.0.0-beta.32`). It advertises `next@^16` support, but it is still beta. Add a J1/J3 manual smoke test on the preview deployment and keep the dependency pinned.

---

## 11. Execution Checklist

### Phase 0 — Branch & baseline (30 min)

- [ ] Create `chore/nextjs-16-upgrade` from `dev`.
- [ ] Record baseline: `npm run typecheck -w @holdmetoit/web`, `npm run test -w @holdmetoit/web`, `npm run build -w @holdmetoit/web`.
- [ ] Confirm clean tree (`git status`).

### Phase 1 — Toolchain (1–2 h)

- [ ] Bump `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next` in `apps/web/package.json`.
- [ ] Run `npm install` from the repo root; commit the lockfile.
- [ ] Replace `apps/web/.eslintrc.json` with `apps/web/eslint.config.mjs`.
- [ ] Update the `lint` script to `eslint app components core features lib types`.
- [ ] Remove the `eslint` block from `next.config.mjs`.

### Phase 2 — Framework code (2–4 h)

- [ ] Await `cookies()` in `preview-mode.actions.ts`.
- [ ] Remove the in-memory rate limiter and its call sites (separate security commit).
- [ ] Convert `params`/`searchParams` to Promises in the 8 pages and 3 `generateMetadata` functions.
- [ ] Change `revalidateTag(tag)` → `revalidateTag(tag, { expire: 0 })`.
- [ ] Rename `middleware.ts` → `proxy.ts`, export `proxy`, rename the test.
- [ ] Move `outputFileTracingIncludes` and `serverExternalPackages` to the top level of `next.config.mjs`.
- [ ] Keep `experimental.serverActions.bodySizeLimit`.

### Phase 3 — Tests (1–2 h)

- [ ] Wrap page props in `Promise.resolve(...)` in the 6 test files.
- [ ] Update cache test expectations.
- [ ] Update proxy test imports.
- [ ] Run the full web suite; fix only genuine React 19 failures.

### Phase 4 — Verification (1–2 h)

```bash
npm run build -w @holdmetoit/database
npm run build -w @holdmetoit/discord
npm run typecheck -w @holdmetoit/web
npm run lint -w @holdmetoit/web
npm run test -w @holdmetoit/web
npm run build -w @holdmetoit/web
npm audit --omit=dev
```

- [ ] `next build` succeeds with Turbopack (no `--webpack` fallback needed).
- [ ] `/changelog` renders entries from the traced `CHANGELOG.md`.
- [ ] No `UnsafeUnwrappedCookies` / `UnsafeUnwrappedHeaders` remains.
- [ ] `git grep -n "next lint"` returns nothing.

### Phase 5 — Manual E2E on the preview deployment

- [ ] **J1:** Guest opens `/challenge/:id`; “Login with Discord” completes; user row upserts.
- [ ] **J2:** Admin creates a challenge; teams/rosters save.
- [ ] **J3:** Participant declares target + weekly goals; kickoff locks declarations.
- [ ] **J4:** Log `04:30:00`; deficit pace and standings update.
- [ ] **J5:** Admin inline override saves `isOverride=true`; totals recalculate.
- [ ] **J6:** Admin locks results; punishment flags respect the three-condition invariant.
- [ ] Mobile 360px check on `/`, `/challenge/[id]`, `/wallet`, `/pokemon`.
- [ ] Admin route gate (`proxy`) still redirects unauthenticated users.
- [ ] Loading / empty / error states still render (Law L9).

### Phase 6 — Docs & merge

- [ ] Update `SECURITY.md` SEC-02 (new version, remaining Prisma findings).
- [ ] Update `HANDOFF.md` session log + next step (prune stale entries per §9.3).
- [ ] Open PR to `dev`; move the issue to `In Review`.
- [ ] After merge + release PR to `main`, move the issue to `Done`.

---

## 12. Risks & Mitigations

| Risk                                                           | Likelihood | Impact | Mitigation                                                                                              |
| :------------------------------------------------------------- | :--------- | :----- | :------------------------------------------------------------------------------------------------------ |
| Auth.js beta + `proxy`/async cookies regression                | Medium     | High   | Manual J1/J3 on preview; keep `5.0.0-beta.32` pinned; test session cookie gate explicitly.              |
| Turbopack cannot bundle `discord.js` / workspace package       | Medium     | High   | Keep `serverExternalPackages`; fall back to `next build --webpack` if blocked and record the deviation. |
| `/changelog` loses `CHANGELOG.md` in the traced bundle         | Medium     | Low    | Verify `/changelog` after build; copy the file into `apps/web` if tracing fails.                        |
| `revalidateTag(..., { expire: 0 })` changes freshness behavior | Low        | Medium | It matches the deprecated single-arg behavior; verify leaderboard/cockpit after a mutation.             |
| React 19 hydration/StrictMode differences                      | Low        | Medium | Run full test suite + manual interactive checks (modals, menus, image cropper).                         |
| ESLint flat config drops a custom token rule                   | Low        | Medium | Port the selectors verbatim (§5.5.3) and run `npm run lint`; compare a known violation.                 |
| `@types/react@19` surfaces new type errors                     | Medium     | Medium | Fix with `useRef(undefined)` / explicit props; do not blanket-`@ts-expect-error`.                       |
| Image optimizer default changes hide images                    | Low        | Low    | Check Discord, Supabase, and raw GitHub images at 360px and desktop.                                    |
| Audit still red after Next upgrade                             | High       | Low    | Expected for Prisma family; track separately and document in `SECURITY.md`.                             |

**Rollback:** the migration performs **no database changes**. Roll back by reverting the PR merge commit (never `git reset --hard`, never force-push). Keep the `chore/nextjs-16-upgrade` branch until the preview deployment has passed J1–J6.

---

## 13. Suggested Commit Sequence

```text
chore(deps): bump next to 16.4.5, react to 19.3, eslint to 9.39
chore(web): migrate eslint to flat config and remove next lint
refactor(web): await async request APIs in pages and actions
refactor(web): rename middleware to proxy
refactor(web): migrate next.config to v16 keys
fix(web): pass cache-life profile to revalidateTag
test(web): update page props and cache mocks
docs(security): record next 16 remediation and remaining prisma advisories
```

Conventional commits per `AGENTS.md` §4.2.

---

## 14. Appendix — Files to Touch (quick reference)

| File                                                               | Change                                               |
| :----------------------------------------------------------------- | :--------------------------------------------------- |
| `apps/web/package.json`                                            | Bump Next/React/types/ESLint; replace `lint` script  |
| `package-lock.json`                                                | Regenerate with root `npm install`                   |
| `apps/web/next.config.mjs`                                         | Remove `eslint`; move tracing/externals to top level |
| `apps/web/eslint.config.mjs`                                       | **New** flat config with existing token guards       |
| `apps/web/.eslintrc.json`                                          | **Delete** after flat config passes                  |
| `apps/web/middleware.ts` → `apps/web/proxy.ts`                     | Rename file + export `proxy`                         |
| `apps/web/middleware.test.ts` → `apps/web/proxy.test.ts`           | Rename file + import `proxy`                         |
| `apps/web/core/cache/index.ts`                                     | `revalidateTag(tag, { expire: 0 })`                  |
| `apps/web/core/cache/index.test.ts`                                | Assert the two-argument call                         |
| `apps/web/features/auth/api/preview-mode.actions.ts`               | `await cookies()`                                    |
| `apps/web/core/security/rate-limiter.ts` / `client-ip.ts` + tests  | **Delete** (external limiter)                        |
| `apps/web/app/api/feedback/route.ts`                               | Remove limiter import + 429 block                    |
| `apps/web/features/ypt/api/ypt-claim.actions.ts`                   | Remove two rate checks                               |
| `apps/web/app/page.tsx`                                            | Async `searchParams`                                 |
| `apps/web/app/challenge/[id]/page.tsx`                             | Async `params` + `searchParams` (page + metadata)    |
| `apps/web/app/challenge/[id]/participant/[participantId]/page.tsx` | Async `params` + `searchParams` (page + metadata)    |
| `apps/web/app/profile/[userId]/page.tsx`                           | Async `params` + `searchParams` (page + metadata)    |
| `apps/web/app/profile/page.tsx`                                    | Async `searchParams`                                 |
| `apps/web/app/wallet/page.tsx`                                     | Async `searchParams`                                 |
| `apps/web/app/pokemon/page.tsx`                                    | Async `searchParams`                                 |
| `apps/web/app/devboard/page.tsx`                                   | Async `searchParams`                                 |
| 6 page `*.test.tsx` files (§5.1.3)                                 | Wrap props in `Promise.resolve(...)`                 |
| `apps/web/next-env.d.ts`                                           | Commit the regenerated file                          |
| `SECURITY.md`                                                      | Update SEC-02 after the upgrade                      |
| `HANDOFF.md`                                                       | Session log + next step (prune stale entries)        |

No Prisma schema or migration changes are required for this upgrade.

---

## 15. References

- Next.js 16 upgrade guide: <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Next.js 15 upgrade guide: <https://nextjs.org/docs/app/guides/upgrading/version-15>
- Next.js ESLint setup (flat config): <https://nextjs.org/docs/app/api-reference/config/eslint>
- `revalidateTag`: <https://nextjs.org/docs/app/api-reference/functions/revalidateTag>
- `unstable_cache` status: <https://nextjs.org/docs/app/api-reference/functions/unstable_cache>
- `serverExternalPackages`: <https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages>
- `outputFileTracingIncludes`: <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>
- React 19 upgrade guide: <https://react.dev/blog/2024/04/25/react-19-upgrade-guide>
- Advisory `GHSA-2464-fhr4-w9xw` (SVG Image Optimizer RCE): <https://github.com/advisories/GHSA-2464-fhr4-w9xw>
- Advisory `GHSA-p3m5-59mp-jv5r` (Server Actions DoS): <https://github.com/advisories/GHSA-p3m5-59mp-jv5r>
- Existing audit context: `SECURITY.md` §SEC-02.
