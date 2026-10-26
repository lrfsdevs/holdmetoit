## What's Changed

Release merge of `dev` → `main` — 8 PRs, 50 commits, 102 files changed.

### 🚀 Features

- **14-hour daily study evaluation cap** — capped duration math in the domain layer, input bounds + health notices in daily and admin override modals, reward cap at 1,400 coins/day, and actual-vs-counted hours in participant history. Closes #172. by @KrishJdev in #173
- **Challenge image crop & resolution validation** — 5:1 banner and 1:1 punishment PFP cropping with minimum resolution checks before upload. by @007HSingh in #178
- **Resilient Discord avatar sync** — on-demand OAuth avatar refresh with profile button, 404 healing, token persistence, and re-auth handling. Closes #96. by @KrishJdev in #179
- **Standardized Jira feedback issues** — `[GH-#]` summary prefix, original GitHub issue link in the description, inferred layer/module tags, and native GitHub remote web links. Closes #167. by @KrishJdev in #181
- **YPT bot auto backups** — scheduled database backups with retention enforcement and offline test coverage. by @HyperAfnan in #174
- **Expandable task descriptions** — long descriptions can expand/collapse in the cockpit with a hover tooltip. by @KrishJdev in #171
- **YPT bot restructure** — layered modules, `server.js` as the single job source, and removal of unused routes. by @lrfsdevs in #176

### 🐛 Bug Fixes

- Fixed task modal dismissing while scrolling description text by isolating the context-menu scroll listener. Closes #147. by @KrishJdev in #171
- Fixed long task descriptions not collapsing correctly due to `line-clamp` conflicts. by @KrishJdev in #171
- Hid the "view by team" control in solo challenges. by @007HSingh in #177
- Fixed stale Discord PFP sync and avatar 404 caching; verify 404 via `HEAD` before healing to the embedded default. by @KrishJdev in #179
- Persisted OAuth tokens on sign-in and handled expired-token re-auth in avatar sync. by @KrishJdev in #179
- Secured avatar sync with session auth and an `allowOAuth` guard, then removed in-memory rate limiting for serverless compatibility. by @KrishJdev in #179
- Blocked crop-dialog dismissal during export, added keyboard positioning, and corrected banner minimum dimensions/tests. by @007HSingh in #178
- Hardened Prisma connection timeouts against Supabase pooler latency. by @KrishJdev in #173
- Replaced arbitrary `text-[10px]` with the `text-label` design token in participant stats. by @KrishJdev in #173
- Added failure logging and `maxDuration` to the feedback route for Jira/GitHub dispatch resilience. by @KrishJdev in #181

### 📚 Documentation & Maintenance

- Added the no-direct-to-Done issue lifecycle rule to `AGENTS.md`. by @KrishJdev in #171
- Documented the 14h cap, avatar sync, database timeout hardening, and backup retention rules in `HANDOFF.md`. by @KrishJdev in #173, #179
- Added `docs/database-backups/README.md` and documented the YPT bot's layered structure. by @HyperAfnan in #174, #176
- Updated feedback and YPT bot docs; ignored Jira config/export files. by @KrishJdev in #181

### ⚠️ Deployment Notes

- **No Prisma migrations** in this release.
- Updated `apps/web/.env.example` — review new auth/avatar sync variables before deploying.
- Study logs above 14 hours now count as 14 hours for challenge scoring and coin rewards.
- YPT bot is consolidated around the health endpoint and scheduled backup jobs; review `apps/ypt-bot/package.json` scripts if the service is deployed separately.

**Full Changelog**: https://github.com/lrfsdevs/holdmetoit/compare/main...dev
