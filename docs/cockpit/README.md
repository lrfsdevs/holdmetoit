# Unauthenticated Guest Cockpit Experience & Public Spectator Landing

> **Feature Scope:** High-impact guest cockpit dashboard on `/`, interactive preview telemetry, live challenges pulse, gamification ecosystem showcase, and local guest task sandbox with cloud sync on login  
> **Surfaces:** Home Cockpit (`/`), Guest Cockpit (`GuestCockpitView`), Cockpit Tasks Section (`CockpitTasksSection`)  
> **Governance:** Law L4 (Discord Identity Primacy & Public Spectator Fallback), Law L6 (Three-Condition Accountability), Law L8 (Second-Level Precision), Law L9 (Zero-State & Error Resilience)  
> **GitHub Issue:** #91 · **Jira Key:** KAN-9

---

## 1. Executive Summary & Product Intent

Before this capability, unauthenticated visitors who opened the root URL (`/`) encountered a barebones screen with an empty todo list and minimal context. As a result, prospective study community members, spectators, and incoming Discord users had no immediate insight into the value proposition of HoldMeToIt: competitive study accountability, Yeolpumta (YPT) automation, catch-up deficit mechanics, high-stakes forfeit punishments, virtual coin economy, and Pokémon progression.

The **Guest Cockpit View** (`GuestCockpitView`) delivers a rich, on-theme, public landing dashboard on `/` that:

1. **Welcomes Visitors with a Cockpit Hero Banner:**
   - Features high-resolution battle art (`/assets/challenge_hero_battle.jpg`), badge indicators, and clear positioning: _"Competitive Study Accountability & Challenge Cockpit"_.
   - Surfaces a high-prominence **"Sign in with Discord"** primary CTA button styled with `<DiscordIcon />` and theme-compliant semantic tokens.
   - Provides secondary quick-link navigation to **"Browse Challenges"** (`/challenges`) and **"Trophy Leaderboard"** (`/leaderboard`).

2. **Simulates Study Telemetry (2-Column Bento Layout):**
   - **Left: Simulated Study Progress & YPT Telemetry Card:**
      - Mirrors the logged-in `CockpitProgressCard` layout in a preview state (`24:30:00 / 35:00:00`, 70% weekly completion, Pace on Target).
      - Renders telemetry stats: `05:00:00` daily pace target, 🔥 `5 days` study streak, 🌴 `1/2` leave days remaining, and a `⚡ YPT Auto-Sync Ready` badge.
      - Includes a locked CTA footer explaining that signing in activates live logging, YPT group sync, and streak preservation.
   - **Right: Active Challenges & Accountability Pulse Card:**
      - Displays live challenge metadata (format, title, team matchup details) fetched via `challenge.repository.ts`.
      - Automatically falls back to an arena overview explaining Solo, Duo, and Squad battles if no active challenge exists.
      - Outlines the **Three-Condition Accountability Law** and Forfeit PFP wall mechanic, linking visitors directly to `/challenges`.

3. **Showcases the 3-Pillar Gamification & Study Ecosystem:**
   - **Economy & Wagers (`/wallet`):** 100 virtual coins/hour study rewards, immutable append-only ledger, and head-to-head match betting.
   - **Pokémon Gacha & Pokédex (`/pokemon`):** Study-funded banner pulls with a transparent pity counter to collect 1,025+ species.
   - **Trophy Ranks & Wrapped (`/leaderboard`):** Competitive tier advancement (Recruit $\rightarrow$ Champion) and end-of-event personal Wrapped stories.

4. **Reframes Tasks into an Interactive "Guest Sandbox":**
   - Keeps the existing offline-first IndexedDB task checklist fully interactive for guests (`isLoggedIn = false`).
   - Wraps the task checklist in a distinct **"Local Guest Sandbox"** banner with a database badge.
   - Educates the user that tasks created offline persist locally in their browser and automatically sync to their cloud account and the **Discord Tasker Bot** (`/task`) upon signing in.
   - Surfaces one-click **"Load Sample Study Tasks"** starter chips (_"Complete 2h Deep Work block"_, _"Link YPT account"_, _"Join an active Study Challenge"_) so visitors can immediately test checking off and interacting with the task system.

---

## 2. Non-Negotiable Stack Law Invariants

### 2.1 Law L4 (Discord Identity Primacy & Public Spectator Mode)

- Unauthenticated guests can view all public challenge data and explore the cockpit without being forced into an authentication wall.
- No password or email credentials exist. Discord OAuth 2.0 (`identify` scope) remains the sole authentication mechanism.

### 2.2 Law L8 (Second-Level Clock Precision)

- All simulated telemetry bars and target displays in preview mode use second-level clock formats (`24:30:00`, `35:00:00`, `05:00:00`), matching the live platform's domain invariants.

### 2.3 Law L9 (Zero-State & Error Resilience)

- If `upcomingChallenge` is null (no active/upcoming events), the challenge pulse card cleanly renders an on-theme static arena fallback with full battle format descriptions rather than an empty, broken card.
- If the guest has zero tasks in local storage, sample task chips provide immediate utility and prevent layout collapse.

---

## 3. Architecture & File Locations

```
apps/web/
├── app/
│   ├── page.tsx                                                      # Root server component: queries challenge repo for guests as well
│   └── page.test.tsx                                                 # Page tests verifying guest query & rendering
└── features/study-logs/presentation/
    ├── home-cockpit-view.tsx                                         # Switches between GuestCockpitView and Authenticated Cockpit
    ├── home-cockpit-view.test.tsx                                    # Home cockpit branch tests
    └── cockpit/
        ├── guest-cockpit-view.tsx                                    # Main GuestCockpitView component
        ├── guest-cockpit-view.test.tsx                               # Vitest suite (8 tests) covering all guest components & actions
        ├── cockpit-tasks-section.tsx                                 # Task manager with guest sandbox chips & event listener
        └── index.ts                                                  # Barrel export
```

---

## 4. Key Components & Implementation Details

### 4.1 `GuestCockpitView`

- **Location:** `apps/web/features/study-logs/presentation/cockpit/guest-cockpit-view.tsx`
- **Props:**
   - `displayName`: defaults to `"Guest"`.
   - `upcomingChallenge`: nullable public challenge metadata (title, format, teams, banner).
   - `wrappedChallenge`: nullable wrapped challenge view model for post-event summary dialogs.
   - `isAdmin`: boolean flag.
   - `taskSection`: optional override slot for task checklist rendering.
- **Styling:** Strictly uses Obsidian dark tokens (`bg-surface-card`, `border-border-subtle`, `text-content-primary`, `bg-feedback-info`, etc.). Absolutely no raw hex color literals.

### 4.2 Sample Task Dispatch System

- Defined constants:
   ```typescript
   export const LOAD_SAMPLE_TASK_EVENT = "hmt:load-sample-task";
   export const SAMPLE_STUDY_TASKS = [
      "Complete 2h Deep Work block",
      "Link YPT account (/profile)",
      "Join an active Study Challenge",
   ];
   ```
- Clicking any sample chip dispatches a `CustomEvent(LOAD_SAMPLE_TASK_EVENT, { detail: { title } })`.
- `CockpitTasksSection` listens for the event, assigns it to the `General` category, and persists it into IndexedDB via `putLocalCategory` and `putLocalTask`.

---

## 5. Verification & Testing

- **Unit Tests:** `npm run test -w @holdmetoit/web`
   - `guest-cockpit-view.test.tsx`: 8 unit tests verifying hero banner, CTA buttons, telemetry card, challenge pulse, ecosystem cards, guest sandbox banner, and sample task dispatches.
   - `home-cockpit-view.test.tsx`: verifies conditional rendering of guest vs logged-in views.
   - `page.test.tsx`: verifies server-side data fetching for unauthenticated sessions.
- **Typecheck:** `npm run typecheck:web` passes with 0 errors.
- **Linting:** `npm run lint:web` passes with 0 design-token or syntax errors.
- **Production Build:** `npm run build:web` successfully compiles all routes including `/`.
