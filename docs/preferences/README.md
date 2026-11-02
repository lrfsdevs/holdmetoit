# User Preferences & Completion Sound Effects Architecture

> **Feature Scope:** `features/preferences/`  
> **Route:** `/preferences`  
> **Related Issue / Ticket:** GitHub [#216](https://github.com/lrfsdevs/holdmetoit/issues/216) · Jira `KAN-73`  
> **Design Alignment:** Obsidian Dark & Clean Minimalist Gaming (`DESIGN.md`)  
> **Last Updated:** 2026-11-02

---

## 1. Overview & Problem Statement

HoldMeToIt provides celebratory visual feedback (confetti particles) when participants complete daily or weekly tasks in the cockpit (`cockpit-tasks-section.tsx`), but lacked an auditory feedback mechanism. Adding audio feedback makes completing study goals tangible, rewarding, and gamified.

However, unexpected sound effects in study platforms can be disruptive in quiet environments (libraries, silent study streams, late-night study sessions). Therefore:

- The celebratory completion sound effect ("Yippee!") is **strictly disabled by default (opt-in)**.
- Users have a prominent, easily accessible **Preferences** interface (`/preferences` & header navigation) to configure and enable audio feedback.
- The Preferences interface serves as an extensible hub with **Themes** and **Notifications** sections staged as **Coming Soon**.

---

## 2. Architectural Layers (Feature-First Slice)

```
apps/web/
├── app/
│   └── preferences/
│       └── page.tsx                      # Server entry point at /preferences
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
│       ├── preferences-view.tsx         # Obsidian Dark responsive settings view
│       └── preferences-view.test.tsx    # Presentation tests for UI, toggles, preview & coming soon states
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

1. The user explicitly toggles the setting on in `/preferences`, OR
2. The user clicks the "Preview" button inside Preferences (`preview: true`).

### Invariant: Safe & Silent Playback

Audio playback errors (e.g. browser autoplay policy restrictions, missing audio drivers, or unsupported audio APIs) are caught and handled gracefully without interrupting task mutations, IndexedDB persistence, or UI reactivity.

---

## 4. UI Sections & Roadmap Staging

1. **Audio Feedback Card:**
   - Shows active status (`Enabled` vs `Muted by Default`).
   - "Task Completion Sound ('Yippee!')" description and opt-in notice.
   - Interactive "Preview" button to sample the audio even when disabled.
   - Radix-backed Obsidian toggle switch (`data-testid="todo-sfx-switch"`).

2. **Themes & Aesthetics Card (Coming Soon):**
   - Displays prominent `Coming Soon` badge.
   - Visual swatch preview grid showcasing **Obsidian Dark** (active default), **Midnight Azure** (coming soon), **Emerald Forest** (coming soon), and **Cozy Sunset** (coming soon).

3. **Notifications & Reminders Card (Coming Soon):**
   - Displays prominent `Coming Soon` badge.
   - Previews planned toggles: Daily Rollover Task Digest, Challenge Kickoff Alerts, and Study Deficit Pacing Nudge.

---

## 5. Verification & Testing

- Domain & storage tests:
   ```bash
   npx vitest run apps/web/features/preferences/domain/user-preferences.test.ts
   npx vitest run apps/web/features/preferences/data/preferences-storage.test.ts
   ```
- Audio controller & UI tests:
   ```bash
   npx vitest run apps/web/features/preferences/presentation/audio-service.test.ts
   npx vitest run apps/web/features/preferences/presentation/preferences-view.test.tsx
   ```
- Task completion integration tests:
   ```bash
   npx vitest run apps/web/features/study-logs/presentation/cockpit/cockpit-tasks-audio.test.tsx
   ```
- Header navigation tests:
   ```bash
   npx vitest run apps/web/components/ui/header.test.tsx
   ```
