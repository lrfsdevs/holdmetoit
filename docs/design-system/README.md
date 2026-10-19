# Design System — Token Architecture

**Location of truth:** `apps/web/app/globals.css`
**Governance:** `DESIGN.md` §2 (visual values) · `AGENTS.md` §9.4 (feature docs)

## 1. Executive summary & scope

The design system is a **three-tier token architecture**:

| Tier              | Where                           | What it is                                                    | May UI code use it?                                                     |
| :---------------- | :------------------------------ | :------------------------------------------------------------ | :---------------------------------------------------------------------- |
| **1 · Primitive** | `globals.css` → `:root`         | Raw values, no UI meaning (`--primitive-color-neutral-900`)   | ❌ **No** — no Tailwind utilities are generated, so they're unreachable |
| **2 · Semantic**  | `globals.css` → `@theme inline` | Meaning aliases over primitives (`--color-text-tertiary`)     | ✅ Yes — this is the default for UI code                                |
| **3 · Component** | `globals.css` → `@theme inline` | Component aliases over semantic (`--color-button-primary-bg`) | ✅ Yes — for the shared `components/ui` primitives                      |

The goal is one palette, one vocabulary, and a structural guarantee that UI code cannot
reach raw values.

## 2. Domain decisions & invariants

- **Only two tiers are public.** Primitives are plain CSS vars; because they are not
  declared in `@theme`, Tailwind emits **no** `bg-neutral-900`-style utilities. The only
  leak path is a literal `var(--primitive-*)`, which is banned outside `globals.css`.
- **Meaning over appearance.** UI picks `surface-elevated`, never `neutral-875`. If the
  value changes, every consumer follows.
- **Colour forcing rules:** any state carried by colour also carries an icon/text/shape
  (see `DESIGN.md` §1.2). No raw hex (`*-[#rrggbb]`) anywhere in UI code.
- **Family map:** `brand-1` = gold (currency/primary), `brand-2` = admin amber,
  `brand-3` = rose (negative money); `green`/`blue`/`violet`/`red` power the feedback and
  team-house palettes.

## 3. Token reference

### 3.1 Primitive colour (anchored; full 50–950 ramps generated)

| Family                              | Anchors                                             |
| :---------------------------------- | :-------------------------------------------------- |
| `neutral`                           | 50 `#f4f3f6` → 950 `#0d0d0d` (see `DESIGN.md` §2.1) |
| `brand-1`                           | 400 `#fbbf24` · 500 `#f59e0b` · 600 `#d97706`       |
| `brand-2`                           | 400 `#f59a3c` · 500 `#e08a32`                       |
| `brand-3`                           | 500 `#f43f5e`                                       |
| `green` / `blue` / `red` / `violet` | 300 / 500 / 950 anchored                            |

Non-colour primitives: typography (families, 12–48px sizes, weights, line-heights,
tracking), size (spacing 0–64, icon/container), radius (none→full), border width,
elevation (`shadow-1..3`), opacity (0–100) and motion (durations + easings).

### 3.2 Semantic colour

`text-*` (`text-primary|secondary|tertiary|inverse|disabled|link|brand`),
`surface-*` (`page|primary|secondary|tertiary|elevated|nested|inverse|disabled|brand-1..3`),
`border-*` (`default|subtle|strong|focus|disabled|brand`),
`icon-*`, `action-*` (`primary[-hover|-pressed|-text|-disabled] | secondary | destructive | brand`),
`feedback-*` (`success|warning|error|info` each with `-bg`/`-text`), `accent[-bg|-text]`,
`input-*` (`bg|border|text|placeholder|focus`), `overlay-*` (`scrim|backdrop`).

Semantic radius (`control|card|dialog|pill`), elevation (`card|dropdown|popover|modal`)
and motion (`ease-standard|ease-decelerate`) are declared alongside.

### 3.3 Typography & sizing

- **Type scale:** `text-micro` 8 · `text-caption` 9 · `text-label` 10 · `text-meta` 11 ·
  `text-body` 15 · `text-body-lg` 16 · `text-display-sm/md/lg/xl/2xl` 32/36/38/60/80.
  These extend Tailwind's default scale; fluid `clamp(...)`/`0.3em` sizes stay arbitrary.
- **Sizing:** `control-sm` 44 (touch target) · `control-md` 50 · `control-lg` 74 ·
  `dropdown-min` 170 · `artwork-sm/md` 200/240 · `panel-sm/md/lg` 400/620/840 →
  `min-h-control-sm`, `h-control-md`, `min-w-dropdown-min`, `max-w-panel-lg`, …
  Layout math (`calc`/`min`/`vh`/`var`/`env`) and one-off dimensions stay arbitrary.

### 3.4 Component colour

`button-*` (primary/secondary/destructive/brand/admin + states), `card-*`, `modal-*`,
`dropdown-*`, `nav-*`, `badge-*`, `radio-*` (bg/border/selected), `switch-*`
(track/track-active/thumb), `checkbox-*` (bg/border/check). Each shared primitive
consumes only its own tokens.

**Primitive inventory (29):** alert, alert-dialog, avatar, badge, button, card, checkbox,
command, context-menu, data-pagination, dialog, dropdown-menu, header, input, label,
popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner,
switch, table, tabs, textarea, tooltip.

## 4. Developer usage

```tsx
// Server or client component — semantic tokens only.
<div className="bg-surface-primary border border-border-default rounded-card">
   <h2 className="text-text-primary">Standings</h2>
   <p className="text-text-tertiary">Updated 2 minutes ago</p>
   <button className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover">
      Log hours
   </button>
</div>

// Destructive confirm
<span className="text-feedback-error">Removal cannot be undone</span>

// Component-level (inside components/ui only)
<button className="bg-button-primary-bg text-button-primary-text hover:bg-button-primary-hover" />
```

Opacity modifiers work: `bg-surface-elevated/50`, `border-feedback-success/40`.

## 5. Security & authorization

Not applicable — tokens carry no authorization semantics. RBAC stays in the feature/API
layers (`requireDevUser`, `hasAdminPrivileges`).

## 6. Lifecycle & migration status

| Slice                                           | Status                                                                                                                                                               |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — tiers defined in `globals.css`              | ✅ done                                                                                                                                                              |
| 1 — hex → semantic tokens                       | ✅ done (2,703 utilities, 78 files; raw SVG/style hex → `var(--color-*)`)                                                                                            |
| 2 — `obsidian-*` → semantic                     | ✅ done (894 usages, 38 files)                                                                                                                                       |
| 3 — component tokens adopted by `components/ui` | ✅ done (button, badge, input, textarea, select, card, dialog, alert-dialog, sheet, dropdown-menu, popover, command, header)                                         |
| 4 — `obsidian-*` alias layer deleted            | ✅ done (`tailwind.config.ts`)                                                                                                                                       |
| 5 — ESLint enforcement + CI lint step           | ✅ done (6 rules, verified with a probe)                                                                                                                             |
| 6 — typography + recurring-size tokenisation    | ✅ done (332 font sizes → 11 tokens; 9 recurring sizes → control/dropdown/artwork/panel tokens; layout math + one-offs allowlisted)                                  |
| 7 — missing UI primitives added (11 → 29)       | ✅ done (tabs, switch, tooltip, progress, avatar, separator, label, alert, radio-group, scroll-area, skeleton; `TooltipProvider` mounted; `primitives.test.tsx` 9/9) |

**Enforcement is live** (`apps/web/.eslintrc.json`, core `no-restricted-syntax`):

1. No raw hex colour utilities (`bg-[#…]`, `text-[#…]`, …).
2. No raw hex in `fill`/`stroke`/`color` JSX attributes.
3. No `var(--primitive-*)` outside `globals.css`.
4. No legacy `obsidian-*` tokens.
5. No arbitrary px font sizes (`text-[Npx]`).
6. No re-introduced tokenised size literals (`min-h`/`h`/`min-w`/`max-w-[44|50|74|170|200|240|400|620|840px]`).

`npm run lint -w @holdmetoit/web` is now an explicit CI step and lints
`app · components · features · core · lib`.

Known allowlists (data, not theme tokens): `features/challenges/presentation/challenge-creator-wizard.tsx`
(preset team colours stored as `color: "#…"` object properties — not matched by the
class/attribute rules) and test fixtures.

### 6.1 Phase D — primitive adoption (in progress)

The kit is complete; adoption across the app is ~0%. Targets (verified 2026-10-18):

| Primitive                          | Replacement targets                                                                           |
| :--------------------------------- | :-------------------------------------------------------------------------------------------- |
| `label`                            | ✅ done — 67 labels / 19 files (primitive neutralised; `htmlFor`/`id` + `role="group"` wired) |
| `skeleton`                         | ~20 `animate-pulse` (10 `app/**/loading.tsx` + component-level)                               |
| `scroll-area`                      | 9 feature containers (`overflow-y-auto`; 5 already inside `components/ui`)                    |
| `avatar`                           | 31 `<Image>` across ~22 files (decide: wrap `next/image`?)                                    |
| `tabs`                             | 🔶 DevBoard done; `cockpit-tasks-section` pending                                             |
| `separator`                        | 3 `<hr>` (`challenge-overview-tab`)                                                           |
| `progress`                         | 1 (`trophy-progress-bar`)                                                                     |
| `switch` / `radio-group` / `alert` | 0 adopters — adopt on contact                                                                 |

### 6.2 Phase E — sweeps (not started)

a11y (focus-visible, ≥44px targets, full keyboard nav, modal focus trap/restore) ·
360px responsive pass · motion vs `prefers-reduced-motion` · DevBoard "Design"
living styleguide · real-browser visual pass (manual).

Arbitrary **layout math** and one-off dimensions remain intentional and are not linted.

**Decommission:** complete — the `obsidian-*` keys are gone from
`tailwind.config.ts` and this document is the sole reference.
