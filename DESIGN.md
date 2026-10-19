# DESIGN.md — Visual Identity, Aesthetic & Design System

> **Project:** HoldMeToIt (Gamified Study Accountability Platform)  
> **Aesthetic Direction:** _Obsidian Dark & Clean Minimalist Gaming_ (Ratified in Figma Alignment Overhaul)  
> **Status:** Ratified Active Design System  
> **Last Updated:** 2026-10-06

---

## 1. Creative Direction & Aesthetic Philosophy

### 1.1 The Obsidian Dark Aesthetic

HoldMeToIt utilizes a sleek, dark **Obsidian aesthetic** engineered for deep focus, clean data density, and long study sessions without ocular fatigue.

- **Atmosphere:** Pitch-dark ambient workspaces (`#0d0d0d`), subtle slate card elevations (`#141414`, `#1c1c1c`), crisp contrasting typography (`#f4f3f6`), and refined house accent colors.
- **Tone:** Focused, modern, competitive yet encouraging.
- **Clarity First:** Monospace tabular numbers (`HH:MM:SS`), scannable split-share progress bars, distinct house tags, and zero layout shift.

```
Visual Tone Hierarchy:
┌──────────────────┬────────────────────────────────────────────────────────┐
│ Canvas Base      │ Deep Obsidian Charcoal (#0d0d0d)                      │
│ Surfaces         │ Obsidian Slate Cards (#141414), Elevated Trays (#1c1c1c)│
│ Accents          │ Vibrant emerald (#22c55e), azure (#3b82f6), purple     │
│ Precision        │ Monospace tabular digits for HH:MM:SS durations        │
│ Geometry         │ Squircles & pill buttons, 12px (0.75rem) - 20px radii  │
└──────────────────┴────────────────────────────────────────────────────────┘
```

### 1.2 Anti-Slop & Quality Guardrails

All UI components adhere to strict anti-slop guidelines:

- ❌ **No blinding neon glows or heavy blurs:** Keep contrast sharp with 1px border definitions (`border-border-default`).
- ❌ **No distracting looping animations:** Use static badges and purposeful transitions (`transition-all duration-200`).
- ❌ **No layout shift on clocks:** Enforce `tabular-nums` monospace numbers for all second-level durations.
- ❌ **No horizontal overflow on 360px:** Responsive stacking and card conversions are mandatory across all views.
- ❌ **No raw hex, no primitive access:** UI code must use semantic/component tokens (see §2). Arbitrary `*-[#rrggbb]` colours and `var(--primitive-*)` outside `globals.css` are lint errors.

---

## 2. Design Token Architecture (Primitive → Semantic → Component)

All tokens live in **`apps/web/app/globals.css`**, in three tiers:

```
1 · PRIMITIVE   :root { --primitive-color-* … }   raw values, no UI meaning (no utilities generated)
2 · SEMANTIC    @theme inline { --color-* }        meaning aliases — what UI code uses
3 · COMPONENT   @theme inline { --color-<c>-* }    component aliases over semantic tokens
```

**Layering rule:** UI code (`app/`, `components/`, `features/`) may use only **semantic**
and **component** tokens. Primitives are plain CSS vars with no Tailwind utilities, so
they are unreachable; `var(--primitive-*)` outside `globals.css` is a lint error.

### 2.1 Primitive palette (anchored)

| Family                              | Anchor stops                                                                                                                                                                                                                                 |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `neutral`                           | 50 `#f4f3f6` · 200 `#d1d1d1` · 300 `#a3a3a3` · 400 `#868686` · 500 `#545454` · 600 `#484848` · 700 `#434343` · 750 `#333333` · 800 `#292929` · 850 `#242424` · 875 `#1c1c1c` · 900 `#141414` · 910 `#1a1a1a` · 925 `#181818` · 950 `#0d0d0d` |
| `brand-1` (gold)                    | 400 `#fbbf24` · 500 `#f59e0b` · 600 `#d97706`                                                                                                                                                                                                |
| `brand-2` (admin amber)             | 400 `#f59a3c` · 500 `#e08a32`                                                                                                                                                                                                                |
| `brand-3` (rose)                    | 500 `#f43f5e`                                                                                                                                                                                                                                |
| `green` / `blue` / `red` / `violet` | 300 / 500 / 950 anchored (feedback + team-house palettes)                                                                                                                                                                                    |

Full 50–950 ramps are generated in `globals.css`; the anchors above are the exact values
that existed before the migration. Typography, size/spacing, radius, border-width,
elevation, opacity and motion primitives are declared in the same `:root` block.

### 2.2 Semantic tokens (color)

| Group      | Tokens                                                                                                                                                                | Example utility                                       |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| text       | `text-primary` `text-secondary` `text-tertiary` `text-inverse` `text-disabled` `text-link` `text-brand`                                                               | `text-text-tertiary`                                  |
| surface    | `surface-page` `surface-primary` `surface-secondary` `surface-tertiary` `surface-elevated` `surface-nested` `surface-inverse` `surface-disabled` `surface-brand-1..3` | `bg-surface-primary`                                  |
| border     | `border-default` `border-subtle` `border-strong` `border-focus` `border-disabled` `border-brand`                                                                      | `border-border-default`                               |
| icon       | `icon-primary` `icon-secondary` `icon-inverse` `icon-disabled` `icon-brand`                                                                                           | `text-icon-primary`                                   |
| action     | `action-primary(-hover/-pressed/-text/-disabled)` `action-secondary` `action-destructive` `action-brand`                                                              | `bg-action-primary` · `hover:bg-action-primary-hover` |
| feedback   | `feedback-success/-bg/-text` · `feedback-warning*` · `feedback-error*` · `feedback-info*` · `accent/-bg/-text`                                                        | `text-feedback-success`                               |
| input      | `input-bg` `input-border` `input-text` `input-placeholder` `input-focus`                                                                                              | `bg-input-bg`                                         |
| overlay    | `overlay-scrim` `overlay-backdrop`                                                                                                                                    | `bg-overlay-scrim`                                    |
| typography | `text-micro/caption/label/meta/body/body-lg/display-sm/md/lg/xl/2xl`                                                                                                  | `text-meta`                                           |
| sizing     | `control-sm` 44 · `control-md` 50 · `control-lg` 74 · `dropdown-min` 170 · `artwork-sm/md` 200/240 · `panel-sm/md/lg` 400/620/840                                     | `min-h-control-sm` · `max-w-panel-lg`                 |

### 2.3 House (team) presets → feedback + palette tokens

| Preset                | Background               | Border                    | Text                         |
| :-------------------- | :----------------------- | :------------------------ | :--------------------------- |
| **Serpents / Forest** | `bg-feedback-success-bg` | `border-feedback-success` | `text-feedback-success-text` |
| **Raven / Azure**     | `bg-feedback-info-bg`    | `border-feedback-info`    | `text-feedback-info-text`    |
| **Purple / Dusk**     | `bg-accent-bg`           | `border-accent`           | `text-accent-text`           |
| **Crimson / Forfeit** | `bg-feedback-error-bg`   | `border-feedback-error`   | `text-feedback-error-text`   |

### 2.4 Legacy aliases (removed)

The temporary `obsidian-*` alias layer was deleted in migration slice 4 and no longer
resolves — `tailwind.config.ts` holds no `obsidian` block. Use Tier-2 semantic tokens
only. Full guide: `docs/design-system/README.md`.

---

## 3. Typography System

### 3.1 Typefaces

1. **Primary Interface Sans:** `Inter` (`--font-sans`, Tailwind `font-sans`)
   - Clean, geometric clarity for navigation, body text, form controls, and table data.
2. **Display & Headings:** `Outfit` (`--font-display`, Tailwind `font-display`)
   - Expressive, modern geometric display font for large section headers, banner titles, and hero titles.
3. **Tabular Monospace Clocks:** Monospace with `tabular-nums`
   - Rock-solid digit alignment (`font-variant-numeric: tabular-nums`) preventing jumping during time calculations.

### 3.2 Type Scale (tokens)

| Token              |  Size  | Typical usage                       |
| :----------------- | :----: | :---------------------------------- |
| `text-micro`       | `8px`  | micro badges / superscripts         |
| `text-caption`     | `9px`  | tiny meta labels                    |
| `text-label`       | `10px` | pills, timestamps, uppercase labels |
| `text-meta`        | `11px` | helper text, dense table meta       |
| `text-body`        | `15px` | reading copy                        |
| `text-body-lg`     | `16px` | primary body / larger form copy     |
| `text-display-sm`  | `32px` | section display                     |
| `text-display-md`  | `36px` | wrapped headings                    |
| `text-display-lg`  | `38px` | wrapped hero headings               |
| `text-display-xl`  | `60px` | stat numerals                       |
| `text-display-2xl` | `80px` | hero numerals                       |

Tailwind's default scale (`text-xs`/`sm`/`base`/`lg`…) remains available; the tokens
above **extend** it. Fluid/art-directed sizes (`clamp(...)`, `0.3em`) stay arbitrary on
purpose.

### 3.3 Tabular clocks

All `HH:MM:SS` values use `tabular-nums` (`.font-sans-tabular` or `font-mono`) so digits
never shift during updates.

---

## 4. Component Visual Specifications

> **Primitive inventory (29):** alert, alert-dialog, avatar, badge, button, card, checkbox,
> command, context-menu, data-pagination, dialog, dropdown-menu, header, input, label,
> popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner,
> switch, table, tabs, textarea, tooltip — all in `apps/web/components/ui`, built on
> semantic/component tokens only.

### 4.1 Challenge Hero Banner

- **Container:** High-resolution event image with `66%` dark vignette overlay (`bg-black/66`), rounded corners (`rounded-2xl sm:rounded-3xl`).
- **Header Elements:**
   - Dynamic status badge: `UPCOMING` (amber), `ACTIVE` (emerald), `COMPLETED` (purple).
   - Countdown ticker displaying days/hours remaining.
   - In-place modal trigger for "Enroll in Challenge".
   - Secondary "Rules & Info" button.

### 4.2 Home Cockpit Banner (7 Dynamic Variants)

- **Engine:** `cockpit-banner.ts` dynamically evaluates participant state:
   1. `NOT_ENROLLED_HAS_ACTIVE`: Hero banner prompting enrollment in ongoing battle.
   2. `NOT_ENROLLED_HAS_UPCOMING`: Teaser for upcoming season.
   3. `ACTIVE_LOGGED_TODAY`: Serene completion state with positive reinforcement.
   4. `ACTIVE_NEEDS_LOG`: Urgent prompt to log hours for today.
   5. `ACTIVE_IN_DEFICIT`: Motivational catch-up banner with required daily pace.
   6. `UPCOMING_ENROLLED`: Pre-kickoff countdown reminder.
   7. `NO_CHALLENGES`: Clean empty state encouraging host creation.

### 4.3 Daily Hours Modal (`HH:MM:SS`)

- **Relative Day Buckets:** Toggles between "Today" and "Yesterday" with server-side UTC date resolution.
- **Preset Quick Chips:** Tactile increments (`+15m`, `+30m`, `+1h`, `+2h`).
- **Clock Inputs:** Tabular inputs for hours, minutes, and seconds, pre-filled with committed hours or current logged values.

### 4.4 Standings: Desktop Table vs Mobile Cards

- **Desktop ($\ge 640\text{px}$):** Full multi-column table (`Rank`, `Participant`, `Team`, `Total Hours`, `Today's Hours`, `Target`, `Status`).
- **Mobile ($< 640\text{px}$):** Transforms into stacked obsidian cards (`rounded-2xl border border-[#262626] p-3`):
   - Line 1: Rank badge, avatar, participant display name with team pill badge.
   - Line 2: Total logged vs target (`{totalLoggedClock}/{targetClock}`), with today's logged hours in vibrant green (`+{todayLoggedClock}`).

### 4.5 Offline Task Board (Daily & Weekly Checklists)

- **Layout:** Side-by-side or stacked Daily and Weekly columns with category groupings.
- **Drag & Drop:** Elevated floating card feedback, custom HTML5 drag previews, and instant 0ms IndexedDB reordering.

---

## 5. Mobile Layout & Responsiveness (360px+)

1. **Strict 360px Viewport Guard:** Zero horizontal overflow across all views (`min-w-0`, `truncate`, `overflow-x-auto`).
2. **Touch Target Size:** Interactive controls, pills, and inputs maintain a minimum touch target of `44px x 44px`.
3. **Adaptive Header:** Top navigation collapses the "Sign Out" text to a square icon button on mobile, preventing header clipping.

---

## 6. Tailwind CSS Token Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
   darkMode: ["class"],
   content: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./features/**/*.{ts,tsx}",
   ],
   theme: {
      extend: {
         colors: {
            obsidian: {
               bg: "#0d0d0d",
               card: "#141414",
               elevated: "#1c1c1c",
               nested: "#292929",
               input: "#545454",
               inputBorder: "#484848",
               border: "#292929",
               borderLight: "#434343",
               text: "#f4f3f6",
               textMuted: "#d1d1d1",
               textDim: "#868686",
               serpents: {
                  bg: "#144520",
                  border: "#22c55e",
                  text: "#85ff93",
               },
               raven: {
                  bg: "#102d40",
                  border: "#3b82f6",
                  text: "#85d6ff",
               },
               purple: {
                  bg: "#230e40",
                  border: "#8b5cf6",
                  text: "#a29dae",
               },
               crimson: {
                  bg: "#401010",
                  border: "#ef4444",
                  text: "#ff5757",
               },
            },
         },
         fontFamily: {
            sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
            display: ["var(--font-display)", "Outfit", "Inter", "sans-serif"],
         },
         borderRadius: {
            lg: "var(--radius)",
            md: "calc(var(--radius) - 2px)",
            sm: "calc(var(--radius) - 4px)",
            "2xl": "1rem",
            "3xl": "1.5rem",
         },
         boxShadow: {
            obsidian:
               "0 8px 30px -4px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
         },
      },
   },
   plugins: [tailwindcssAnimate],
};

export default config;
```
