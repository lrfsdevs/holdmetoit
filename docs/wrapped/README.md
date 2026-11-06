# Event Wrapped — Mascot System & Companion Customization

> **Feature Area:** `features/wrapped/`  
> **Milestone:** P0 / Wrapped Experience  
> **Related Tickets:** GitHub [#241](https://github.com/lrfsdevs/holdmetoit/issues/241), Jira [KAN-93](https://krishjaiswal2182003.atlassian.net/browse/KAN-93)  
> **Status:** Active / Production-Ready  
> **Document Last Updated:** 2026-11-03

---

## 1. Overview

The **Customizable Wrapped Mascot System** provides whimsical, responsive companions across the Event Wrapped experience (`/` Shy Card and `/` Story Modal), allowing students to customize their mascot companion in their Profile Settings (`/profile?tab=settings`).

The system preserves the classic **OG Googly Eyes** (`GOOGLY_EYES`) while adding three hand-drawn doodle mascots:

1. **`GOOGLY_EYES` (OG):** Classic chaotic cursor-tracking googly eyes.
2. **`CAT` (Doodle Cat):** Curious peeking kitty with paws on the border, twitching ears, whiskers, and shy blush reaction.
3. **`DOG` (Doodle Dog):** Playful pup with floppy ears, interactive head-tilt, cute snout, and tongue blep reaction.
4. **`BUNNY` (Doodle Bunny):** Shy lop-eared bunny with expressive droop ears, twitching nose, and rosy cheek blush.

---

## 2. Architecture & Pure Domain Isolation (Law L7)

In strict adherence to **Law L7 (Pure Domain Isolation)**, mascot types, variants, options, and validation guards are housed inside pure TypeScript modules with zero React/Next.js/DOM dependencies.

```text
apps/web/features/wrapped/
├── domain/
│   ├── wrapped-mascot.types.ts     # Pure domain variants, options, guards & normalization
│   └── wrapped.ts                  # Re-exports mascot types alongside challenge view models
├── presentation/
│   ├── wrapped-mascot.tsx          # Unified SVG & Googly Eye mascot with cursor tracking
│   ├── wrapped-storage.ts          # LocalStorage mirror, reactive hook & custom window events
│   ├── wrapped-shy-card.tsx        # Dashboard parked card with responsive mascot header
│   ├── challenge-wrapped-modal.tsx # 5-slide story modal with reactive slide-mood mascot
│   └── wrapped-mascot-preference-card.tsx # Profile/Preferences interactive 4-option selector
```

---

## 3. Shared Cursor-Tracking & Mood Engine

All four mascots share a unified tracking engine in `<WrappedMascot />`:

- **Smooth Pupil Tracking:** Measures the vector from the mascot element center to the cursor coordinate `(clientX, clientY)`, smoothly clamping to a max pupil travel radius.
- **Mood / Expression States (`WrappedMascotMood`):**
   - `idle`: Natural resting state with subtle periodic blinking (`animate-shy-blink`).
   - `shy` / `hover`: Elicited on cursor hover or before the verdict reveal. Ears flatten/droop, blush appears, and pupils glance away.
   - `hyped`: Dilated pupils, perked ears, and excited energy (active on story slides 0 & 1).
   - `proud`: Happy curved smiling eyes (`^ ^`) on victorious verdicts and story accomplishments.
   - `sleepy`: Half-closed relaxed eyelids (`- -`) on forfeiture or quiet moments.
- **Accessibility & Reduced Motion:** Respects `prefers-reduced-motion: reduce` and `forceReducedMotion` prop, disabling pupil offsets and continuous head-tilts.

---

## 4. Preference Persistence & Reactivity

- **Storage Key:** `hmt:wrapped:mascot_preference`
- **Broadcast Event:** `wrapped-mascot-change`
- **Hook:** `useWrappedMascotPreference(overrideVariant?)`
   - Immediately synchronizes state across components without requiring a page reload.
   - Listens to both `storage` events (multi-tab sync) and local `CustomEvent` dispatches.
   - Fallback safe: defaults to `"GOOGLY_EYES"` during SSR and in restricted privacy modes.

---

## 5. Developer Usage Example

```tsx
import { WrappedMascot } from "@/features/wrapped/presentation/wrapped-mascot";
import { WrappedMascotPreferenceCard } from "@/features/wrapped/presentation/wrapped-mascot-preference-card";

// Render the interactive mascot anywhere
<WrappedMascot
   variant="CAT"
   mood="proud"
   size="md"
/>

// Drop the preference selector card into any settings/profile layout
<WrappedMascotPreferenceCard />
```
