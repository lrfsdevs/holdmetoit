# Changelog

Notable changes to HoldMeToIt, newest first — grouped by date, no version numbers.

Entries tagged `[user]` are user-facing and shown to everyone. Untagged entries are
internal (engineering, tooling, and infrastructure) and are shown to admins only.

## 2026-10-11

### Lock results after natural expiry [user]

Hosts can lock and finalize a challenge — and evaluate dual-failure punishments —
even after its timer has naturally ended, instead of only before expiry. Results
lock once and stay locked.

### Challenge lock schema

Added `resultsLockedAt` to `Challenge` with an idempotent migration, so
finalization is persisted and repeat-safe.

### Structured event logging & failure diagnostics

Unified, severity-filtered logger wired across all server actions, route handlers,
auth events, and error boundaries — one-line JSON on the server and LogRocket
forwarding on the client.

### Migrated to Vitest 5 + Tailwind CSS 4

Consolidated five dependabot updates, upgraded the test runner (Vitest 3 → 5) and
the styling engine (Tailwind 3 → 4), and raised the Node floor to 22.12.

## 2026-10-10

### Public changelog page [user]

A date-grouped changelog at `/changelog`, rendering this very file. User-facing
entries are public; internal entries are visible to admins.

### Participant weekly target hours override [user]

Mods and devs can adjust any participant's weekly target commitment with an
audit-logged reason, from the Manage tab, the Leaderboard, and participant profiles.

### Remove participants from a roster [user]

Hosts can remove a participant (UPCOMING/ACTIVE only) with a required reason,
purging their logs, punishment, leaderboard, and team-member rows.

### Forfeit picture moved into Overview [user]

Merged the old About tab into Overview and added a Forfeit Avatar card with a
direct "Download Forfeit PFP" button.

### Reset overall time to zero [user]

Admins can reset a participant's accumulated hours to 0, and zero-hour submissions
are no longer blocked.

### Yeolpumta (YPT) integration groundwork [user]

Initial client-side groundwork for importing/aligning with YPT.

### DB migration, error surfacing & CI gates

Added the `isLeave` migration to both study-log tables, re-landed PR #67 after a
schema-drift regression, surfaced cockpit and participant-stats data errors instead
of swallowing them, and added CI that blocks schema changes without a migration.

## 2026-10-09

### Participant statistics profiles [user]

Challenge-specific, read-only participant pages showing declared targets, total
logged time, daily history, rank within team, and leaderboard standing.
(`/challenge/[id]/participant/[participantId]`)

### Search, filtering & "view by team" [user]

Search, filtering, and a view-by-team mode across all data lists, plus pagination
on the leaderboard, participant lists, audit logs, roster, and admin views.

### Dynamic team colors [user]

Teams and their leaderboard entries now derive from a dynamic color palette with
WCAG AA contrast.

### Public challenges directory [user]

New public `/challenges` catalog with role-gated admin controls.

### Audit study-hour submissions [user]

Study-hour submissions are now recorded in the event audit log.

### Move tasks from past days [user]

Daily todos can be moved from past days to today or a future day, with past-day
move guards.

### Header navigation [user]

Replaced the "Admin Console" header button with a "Challenges" link.

### Future-hours guard [user]

Moderators can no longer add or edit hours for future dates.

## 2026-10-08

### Weekly categories as daily parents [user]

Weekly categories can be inherited as parent categories for daily tasks, with an
independent-category option.

### Participant preview mode [user]

A global header toggle lets admins and devs preview every page exactly as a regular
participant sees it.

### Clear-time admin action [user]

Replaced hour presets with a single "clear time" button and removed internal law
labels from the UI.

### Reliability & tooling

Added client-side caching with dynamic stale times, fixed task `dueDate`
preservation across sync and refreshes, integrated the immutable event audit log,
and added a Prettier/ESLint pre-commit hook.

## 2026-10-07

### Week-wide daily tasks [user]

Daily todos across the whole week with an interactive day switcher, plus task
permissions (today/yesterday for regular users; hour editing for mods and devs).

## 2026-10-06

### Offline-first tasks [user]

Tasks persist to IndexedDB (`holdmetoit_db`) and sync to the cloud in the
background, with drag-and-drop reordering of categories and tasks across the daily
and weekly boards.

### Event audit trail & UTC timetables [user]

Immutable event audit trail and strict UTC-normalized challenge timetables.

### Todo status overhaul [user]

Reworked todo states into in-progress, crossed-out, and clean to-do views.

### Challenge-day logging [user]

Log any challenge day via a date selector, with a future guard and UTC formatting.

### Feedback reporting [user]

In-app bug/suggestion reporting with `FB-XX` codes and Discord embed delivery.

### Sync & polish

Feedback observability via LogRocket, and Supabase image remote-pattern fixes.

## 2026-10-05

### Mobile responsiveness & card leaderboard [user]

Optimized layouts for 360px viewports and added a card-based leaderboard view.

### Developer (DEV) role [user]

Introduced the `DEV` role and streamlined Discord RBAC gating.

### Task & category context menus [user]

Added task/category context menus and segregated daily and weekly categories.

### Logging UX [user]

Pre-fill committed hours, support log updates, and conditionally gate the yesterday
toggle.

### Cockpit & admin polish [user]

Empty challenge states in the banner, constrained modal hour/leave inputs, and
aligned admin action buttons with the design.

## 2026-10-04

### Dynamic lifecycle & banners [user]

Dynamic timestamp-based lifecycle status and countdown, plus dynamic dashboard
banner variants and a redesigned challenge hero banner.

### Matchup share & team targets [user]

Dynamic matchup share percentages and team target progress on the leaderboard.

### Categorizable daily & weekly todos [user]

Introduced the categorizable daily/weekly todos architecture.

### Roster & enrollment redesign [user]

Made participant team optional and redesigned the enrollment modal.

### Event header & punishment PFP uploads [user]

Independent event header and punishment PFP uploads via Supabase Storage.

### Obsidian theme & Manage tab [user]

Obsidian theme overhaul, consolidated home cockpit, and the challenge Manage tab.

### Cockpit decomposition & session caching

Split the monolithic home cockpit into modular components, relocated challenge
views and pruned declarations, and deduplicated session reads with React `cache`
plus parallelized page queries.

## 2026-10-03

### Manual weekly hours board [user]

A host-entered weekly hours board for slot-by-slot totals, independent of the
daily-log scoreboard.

## 2026-09-08

### Discord role-based auth [user]

Authorization based on Discord roles.

## 2026-09-07

### Discord auth UI [user]

Integrated the Discord auth header and controls across layouts, with OAuth actions
and the `UserNav` component.

### Self-enrollment & rosters [user]

Participant self-enrollment, admin roster assignment, and avatar domain support.

### Challenge operations [user]

Challenge creator, kickoff/lock triggers, hours override, and the Discord
broadcaster.

### Scoreboard & punishment wall [user]

Live match scoreboard, standings table, and the punishment wall.

### Deployment & QA groundwork

Direct URL for Supabase connection pooling, and the E2E Quality Matrix test suite
certifying the Phase 0 release gate.

## 2026-09-06

### Participant cockpit & daily logging [user]

The first participant cockpit with daily study logging.

### Persistence & Discord auth [user]

Database persistence and the initial Discord authentication flow.

### Interactive study prototype [user]

An interactive, cozy study prototype with bespoke assets.

### Scaffolding

Production app scaffold, pure domain engine, cinnamon design tokens, CODEOWNERS,
and the core documentation suite.

## 2026-09-05

### Initial commit

Repository created.
