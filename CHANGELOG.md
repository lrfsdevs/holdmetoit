# Changelog

Notable changes to HoldMeToIt, newest first — grouped by date, no version numbers.

Entries tagged `[user]` are user-facing and shown to everyone. Untagged entries are
internal (engineering, tooling, and infrastructure) and are shown to admins only.

## 2026-11-02

### Preferences hub & completion sound effect [user]

Added a dedicated preferences page accessible via the header. Customize themes, manage notifications, and toggle an opt-in "yippee" sound effect that plays when completing tasks.

### Leaderboard progress & pace status indicators [user]

Desktop standings now feature Progress % and real-time Pace Status badges (On Track, At Risk, Completed, Punished). Team view also displays unassigned participants in a dedicated section.

### Weekly goals checklist on participant profiles [user]

Participant profile pages now display a paginated checklist of challenge-linked weekly goals.

### Study log limits & hours preservation [user]

Raised the raw daily log cap to 20 hours for comprehensive logging, with a 12-hour scored cap for leaderboard rankings. When withdrawing mid-challenge, your historical study hours are now safely frozen and preserved.

### Leaderboard quick-pardon & compact host actions [internal]

Hosts can now trigger the pardon modal directly from post-lock leaderboard rows with compact icon actions.

### Weekly task anchoring & auto-lock reconciliation [internal]

Weekly tasks are anchored to their creation week to prevent sticking across new weeks, and three-condition accountability checks now auto-reconcile on 6-hour grace auto-locks.

## 2026-11-01

### Guest cockpit dashboard [user]

Unauthenticated visitors can now explore a fully interactive guest cockpit landing page before logging in with Discord.

### Sick mode status badge [user]

Added a Sick Mode toggle to profiles with a temporary status badge and an automatic 3-day reminder prompt.

### Confetti on task completion [user]

Checking off any daily or weekly task now triggers an obsidian-themed celebratory confetti burst.

### Anchored Head-to-Head banner & dynamic leader badge [user]

Matchup banner cards remain anchored at the top of the leaderboard with a dynamic badge highlighting the leading team.

### Global user profiles [user]

New public `/profile/[id]` pages featuring career study statistics, challenge participation snapshots, and direct links from leaderboards.

### Admin user directory console [internal]

Added a searchable `/admin/users` management console with an inspector side-sheet for viewing account details, assigning roles, and reviewing user audit trails.

### Multi-tab offline queue concurrency hardening [internal]

Secured task sync with Web Locks leader election across browser tabs, scoped mutations by user ID, and routed persistent failures to a dead-letter queue with manual retry options.

## 2026-10-31

### Homescreen welcome link to global profile [user]

The cockpit welcome message now links directly to your global profile and career stats.

### Optimistic concurrency & single write path for tasks [internal]

Consolidated task edits, moves, and rollovers through the offline sync queue. Added per-row revision counters on tasks and categories to prevent lost updates during concurrent edits.

### Field-scoped edits & category uniqueness [internal]

Task edits now send field patches instead of full rows, and active category names enforce case-insensitive uniqueness per user. Upgraded Zod to 4.6.6.

## 2026-10-30

### Serialized challenge results lock & input freeze [internal]

Enforced row locks on challenge finalization, froze study logs and goal linkages at lock time, and added a unique database constraint guaranteeing one punishment record per participant.

### Shared Discord interaction package [internal]

Extracted shared Discord interaction handling into the `@holdmetoit/discord` package for unified web and Tasker bot communications.

## 2026-10-29

### Task status transition & hydration stability [internal]

Eliminated task status flicker and sync flashes during rapid status toggles.

## 2026-10-28

### Calendar week navigation & compact date picker [user]

Added calendar week navigation and a compact popover date picker to the task board, making it easy to jump across challenge days.

### Category collapse state persistence [user]

Task category collapsed/expanded states now persist across page refreshes and tab switches without layout shift.

### Daily rollover snooze & mobile view switcher [user]

Added a daily reminder snooze for unfinished tasks from yesterday, alongside a Daily/Weekly view switcher and quick-add actions on mobile.

### YPT bot HEAD /health probe & date range fixes [internal]

Added HEAD `/health` liveness checks to the YPT bot and fixed date boundary calculations for non-7-day challenges.

## 2026-10-27

### Optional punishment profile pictures [user]

Hosts are no longer required to provide a punishment image when creating challenges; unpunished forfeits safely omit download prompts.

## 2026-10-26

### Duo team self-renaming [user]

Participants in duo challenges can now customize and rename their own team identity directly from the challenge page.

### Incomplete task rollover & challenge goal scoping [user]

One-click rollover for yesterday's uncompleted tasks and context-menu actions to scope tasks as official Challenge Goals.

### YPT cron execution audit logging [internal]

Background YPT sync runs now record structured execution logs in the `CronLog` database table for admin inspection.

## 2026-10-25

### Personal task checklist without active challenges [user]

The daily task checklist and week navigation are now fully accessible for personal productivity even when not enrolled in a challenge.

## 2026-10-24

### On-demand Discord avatar sync & image cropping [user]

Sync your latest Discord profile picture on demand from your profile page. Challenge creation now includes pre-upload cropping (5:1 banner, 1:1 avatar) with resolution checks.

### 14-hour daily study evaluation cap [user]

Introduced daily hours evaluation caps with visible raw vs counted hours in daily history to encourage healthy study pacing.

### Serverless auth hardening & YPT bot modular refactor [internal]

Replaced in-memory rate limiting with stateless session validation, persisted OAuth tokens for silent re-auth, and refactored the YPT bot into a modular architecture.

## 2026-10-23

### Expandable task descriptions & tooltips [user]

Long task descriptions can now be expanded in-place with hover tooltips for previewing truncated content.

### Automated database backup script [internal]

Added scheduled database backup routines with retention policies to the automation bot.

## 2026-10-22

### Challenge self-withdrawal & undo enrollment [user]

Participants can now self-withdraw from challenges with an immediate undo action in the enrollment interface.

### Multi-issue feedback sync & economy feature gating [internal]

User feedback submissions now synchronize automatically across GitHub and Jira. Economy and wallet features were isolated behind rollout feature flags.

## 2026-10-21

### LogRocket session recording feature flag [internal]

Client session recording gated behind a feature flag for instant disabling without deployments.

## 2026-10-20

### Open Graph previews for Discord embeds [user]

Challenge and profile links now generate rich Open Graph embeds when shared on Discord and social platforms.

---

## 2026-10-19

### Leaderboard ordering, hero cleanup, and join CTA state [user]

The trophy leaderboard now always starts at rank #1 on page 1, regardless of how the
underlying rows arrive. Removed the internal "Clash of Clans Style League" header pill,
and the "Join Active Battles" button is now hidden while you are already enrolled in an
ongoing challenge.

## 2026-10-15

### Participant preview hides all admin controls

Fixed "Preview as Participant" so admins/devs no longer see admin-side surfaces while previewing: the
participant-stats host override, the home-page DevBoard link, and the DevBoard nav link now respect the
preview state, and `/admin` + `/devboard` redirect to `/` while preview is active.

### Challenge Wrapped kill switch

Placed the Challenge Wrapped experience behind the `challenge_wrapped_v1` feature flag: the dashboard
story popup + Shy Card, the post-lock **Summary** tab, the challenge story popup and feedback dialog, and
the wrapped Server Actions all resolve the flag server-side and fail closed, so the feature can be
dark-launched or killed from `/devboard` without a deploy.

## 2026-10-12

### Challenge Summary design token harmonization [user]

Harmonized the post-lock Challenge Summary tab (`?tab=summary`) with the Obsidian design system, replacing all prototype colors with ratified tokens, dynamic team palettes, house verdict badges, and second-level mono tabular clock displays.

### Migrated Challenge Wrapped modal to Tailwind CSS v4

Migrated the challenge wrapped story modal to pure Tailwind CSS v4 utilities and removed the standalone CSS module (`challenge-wrapped-modal.module.css`), maintaining a 100% Tailwind CSS architecture.

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
