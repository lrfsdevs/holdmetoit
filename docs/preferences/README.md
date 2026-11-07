# User Preferences & Completion Sound Effects Architecture

> **Feature Scope:** `features/preferences/`  
> **Location:** Profile Settings tab (`/profile?tab=settings`)  
> **Route Redirect:** `/preferences` $\to$ `/profile?tab=settings`  
> **Related Issue / Ticket:** GitHub [#216](https://github.com/lrfsdevs/holdmetoit/issues/216) · Jira `KAN-73`  
> **Design Alignment:** Obsidian Dark & Clean Minimalist Gaming (`DESIGN.md`)  
> **Last Updated:** 2026-11-06 (Unified Settings Consolidation)

---

## 1. Overview & Architecture Consolidation

HoldMeToIt provides celebratory visual feedback (confetti particles) when participants complete daily or weekly tasks in the cockpit (`cockpit-tasks-section.tsx`), reinforced with an auditory feedback mechanism.

Previously, preferences were rendered across two disparate locations: a separate `/preferences` page with dead mock sections (Themes and Notifications) alongside a duplicate Wrapped Mascot Companion selector, while the user's profile (`/profile?tab=settings`) had a dedicated Settings tab.

In the unified architecture:

- All participant settings are consolidated into a **single Settings tab** on the student's profile view (`/profile?tab=settings`).
- The separate `/preferences` navigation button is removed from `AppHeader`, and `/preferences` permanently redirects to `/profile?tab=settings`.
- The dead mock UI sections ("Themes & Aesthetics" and "Notifications & Reminders") have been pruned from both domain models and presentation components.
- The Wrapped Mascot Companion card is deduplicated, living exclusively in the profile Settings tab.
- Audio Feedback is encapsulated into a dedicated, modular `<AudioSettingsCard />`.

---

## 2. Architectural Layers (Feature-First Slice)

```
apps/web/
├── features/preferences/
│   ├── domain/
│   │   ├── user-preferences.ts          # Pure domain types, default preferences, and sanitizers
│   │   └── user-preferences.test.ts     # 100% pure Vitest unit tests (Law L7)
│   ├── data/
│   │   ├── preferences-storage.ts       # Safe localStorage repository with multi-tab & custom event sync
│   │   └── preferences-storage.test.ts  # Client storage persistence tests
│   └── presentation/
│       ├── audio-service.ts             # Audio controller wrapping /sounds/yippee.mp3 with autoplay fallback
│       ├── audio-service.test.ts        # Unit tests verifying opt-in enforcement & silent failover
│       ├── use-user-preferences.ts      # Reactive client hook subscribing to storage events
│       ├── audio-settings-card.tsx      # Obsidian Dark modular audio feedback card for profile Settings
│       └── audio-settings-card.test.tsx # Unit tests for audio switch toggling and audio preview
└── public/
    └── sounds/
        └── yippee.mp3                   # Bundled celebratory sound effect (44 KB)
```

---

## 3. Product Invariants & Stack Laws

### Law L7: Pure Domain Isolation

All domain interfaces, default objects, and validation functions (`user-preferences.ts`) are pure TypeScript with zero dependencies on React, Next.js, or external UI libraries.

### Invariant: Opt-In Audio

`DEFAULT_USER_PREFERENCES.sound.todoCompletionSfx` is strictly `false`. Audio playback only occurs if:

1. The user explicitly toggles the setting on in `/profile?tab=settings`, OR
2. The user clicks the "Preview" button inside the Audio Feedback card (`preview: true`).

### Invariant: Safe & Silent Playback

Audio playback errors (e.g. browser autoplay policy restrictions, missing audio drivers, or unsupported audio APIs) are caught and handled gracefully without interrupting task mutations, IndexedDB persistence, or UI reactivity.

---

## 4. Settings Tab Layout on `/profile?tab=settings`

Under the profile owner's Settings tab:

1. **YPT Integration Card (`<YptSettingsCard />`):** Handles Yeolpumta group member binding and verified identity.
2. **Audio Feedback Card (`<AudioSettingsCard />`):**
   - Active status badge (`Enabled` vs `Muted by Default`).
   - "Task Completion Sound ('Yippee!')" description and opt-in notice.
   - Interactive "Preview" button to sample the audio even when disabled.
   - Radix-backed Obsidian toggle switch (`data-testid="todo-sfx-switch"`).
3. **Wrapped Mascot Companion Card (`<WrappedMascotPreferenceCard />`):** Single unified companion mascot picker.

---

## 5. Verification & Testing

- Domain & storage tests:
   ```bash
   npx vitest run apps/web/features/preferences/domain/user-preferences.test.ts
   npx vitest run apps/web/features/preferences/data/preferences-storage.test.ts
   ```
- Audio controller & card tests:
   ```bash
   npx vitest run apps/web/features/preferences/presentation/audio-service.test.ts
   npx vitest run apps/web/features/preferences/presentation/audio-settings-card.test.tsx
   ```
- Profile view settings tab integration:
   ```bash
   npx vitest run apps/web/features/participant-stats/presentation/global-profile-view.test.tsx
   ```
- Navbar cleanup tests:
   ```bash
   npx vitest run apps/web/components/ui/header.test.tsx
   ```
