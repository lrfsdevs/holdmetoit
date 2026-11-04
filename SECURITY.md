# SECURITY.md — Security Audit Report

> **Project:** HoldMeToIt (web app + YPT cron/ingest bot + Tasker Discord bot + shared packages)
> **Audit date:** 2026-11-02 · **Remediation update:** 2026-11-04 (Next.js 16 upgrade; in-memory rate limiter removed)
> **Audit type:** Static source review + `npm audit` (no dynamic/penetration testing, no live infrastructure review)
> **Commit reviewed:** `2bd1012`

---

## 1. Scope & Method

| Component                                                        | Path                                                                          | Reviewed                          |
| :--------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------- |
| Web app (Next.js 16, Auth.js v5, Server Actions, Route Handlers) | `apps/web`                                                                    | Yes                               |
| YPT cron / ingest / DB-backup bot                                | `apps/ypt-bot`                                                                | Yes                               |
| Tasker Discord bot (slash + prefix commands, Gemini summarizer)  | `apps/tasker`                                                                 | Yes                               |
| Shared Discord REST/bot helpers                                  | `packages/discord`                                                            | Yes                               |
| Prisma schema & migrations                                       | `packages/database`                                                           | Schema only (not every migration) |
| CI, Docker, compose, repo config                                 | `.github`, `Dockerfile`s, `docker-compose.yml`, `.dockerignore`, `.gitignore` | Yes                               |

**Not done / out of scope:**

- Local `.env` files were deliberately **not** opened. They are git-ignored and none are tracked (`git ls-files` shows only `*.env.example`). Rotate any secret that was ever shared outside the vault.
- No runtime testing, fuzzing, or infrastructure review (Vercel, Supabase RLS/bucket policies, Discord app settings, Jira/GitHub token scopes).
- Findings marked **(verify)** are plausible from code but were not confirmed at runtime.

### Severity scale

| Level        | Meaning                                                                                                    |
| :----------- | :--------------------------------------------------------------------------------------------------------- |
| **Critical** | Remotely exploitable with no or trivial prerequisites; major integrity/confidentiality/availability impact |
| **High**     | Exploitable with realistic prerequisites, or fail-open security control                                    |
| **Medium**   | Defense-in-depth gap, limited-impact abuse, or needs another weakness to be exploitable                    |
| **Low**      | Hardening / best-practice / low-likelihood                                                                 |
| **Info**     | Observation, no direct action required                                                                     |

---

## 2. Summary

| ID                | Severity      | Component          | Title                                                                                                   |
| :---------------- | :------------ | :----------------- | :------------------------------------------------------------------------------------------------------ |
| [SEC-01](#sec-01) | **High**      | web                | YPT ingest endpoint is fail-open when `YPT_INGEST_API_KEY` is unset                                     |
| [SEC-02](#sec-02) | **Resolved**  | web                | Outdated Next.js 14.2.35 with critical/high advisories — upgraded to 16.4.5                             |
| [SEC-03](#sec-03) | **Mitigated** | web / infra        | In-memory rate limiter removed; rate limiting delegated to an external/platform limiter                 |
| [SEC-04](#sec-04) | **Medium**    | web                | Server Actions that read user data with no authentication / no ownership check                          |
| [SEC-05](#sec-05) | **Medium**    | web                | Role model: stale admin privileges, inconsistent role sources, admin-can-demote-anyone                  |
| [SEC-06](#sec-06) | **Medium**    | web / db / ypt-bot | Discord OAuth tokens stored in plaintext; backups are unencrypted full dumps                            |
| [SEC-07](#sec-07) | **Medium**    | web                | Unauthenticated feedback attachments: client-controlled `Content-Type`, public bucket                   |
| [SEC-08](#sec-08) | **Medium**    | web                | Unvalidated feedback `url` / `logrocketSessionId` injected into Discord/GitHub/Jira content             |
| [SEC-09](#sec-09) | **Medium**    | web / bots         | Raw `error.message` returned to clients and Discord users                                               |
| [SEC-10](#sec-10) | **Medium**    | web                | No security response headers (CSP, HSTS, X-Frame-Options, etc.)                                         |
| [SEC-11](#sec-11) | **Medium**    | tasker             | `/yapperize`: fail-open permission check, public output, no cooldown, prompt injection, unbounded fetch |
| [SEC-12](#sec-12) | **Low**       | web                | `/api/users/sync-avatar` lets any user trigger sync for any other user; user enumeration                |
| [SEC-13](#sec-13) | **Low**       | web                | Pokémon `referenceUrl` validated with `z.string().url()` (may allow `javascript:`) **(verify)**         |
| [SEC-14](#sec-14) | **Low**       | web                | Dev-bypass for `/admin` and `/devboard` keyed on `NODE_ENV` + missing env var                           |
| [SEC-15](#sec-15) | **Low**       | infra              | `docker-compose.yml` Postgres: default credentials, published on all interfaces                         |
| [SEC-16](#sec-16) | **Low**       | bots / infra       | Dockerfiles: run as root, `COPY . .`, unpinned third-party apt key, health servers on `0.0.0.0`         |
| [SEC-17](#sec-17) | **Low**       | ypt-bot            | Failed backups leave plaintext dumps in the OS temp dir indefinitely                                    |
| [SEC-18](#sec-18) | **Low**       | web                | LogRocket session replay with default privacy settings; PII (Discord ID) sent                           |
| [SEC-19](#sec-19) | **Low**       | CI                 | No dependency/secret/SAST scanning; actions pinned by tag; single CODEOWNER                             |
| [SEC-20](#sec-20) | **Low**       | web                | Missing `trustHost`/origin configuration for Auth.js on non-Vercel hosts **(verify)**                   |
| [SEC-21](#sec-21) | **Info**      | web                | Positive controls observed                                                                              |

---

## 3. Findings

<a id="sec-01"></a>

### SEC-01 — YPT ingest endpoint is fail-open when `YPT_INGEST_API_KEY` is unset

- **Severity:** High
- **Location:** `apps/web/app/api/v1/ingest/ypt/route.ts`
- **Description:** The bearer check is wrapped in `if (expectedApiKey) { ... }`. If the environment variable is missing or empty (misconfiguration, new environment, preview deploy), the endpoint accepts **unauthenticated** requests. Additionally, the key is compared with `token !== expectedApiKey`, which is not constant-time.
- **Impact:** Anyone who can reach `POST /api/v1/ingest/ypt` can write arbitrary study durations (up to 24 h/day) for any user identified by `discordId` or `yptId` (both are semi-public). This directly breaks leaderboard integrity, Law L6 punishment outcomes, and mints economy coins through `processStudyReward`. It also enables user enumeration via the `USER_NOT_FOUND` vs `NOT_ENROLLED_IN_ACTIVE_CHALLENGE` responses.
- **Remediation:**
   1. Fail **closed**: if `YPT_INGEST_API_KEY` is not set, return `500/503` and log an error.
   2. Compare with `crypto.timingSafeEqual` on equal-length buffers (hash both sides with SHA-256 first).
   3. Add per-key/IP rate limiting and an audit log entry per ingest.
   4. Consider removing the route if `apps/ypt-bot` writes directly to the DB (it does — `apps/ypt-bot/src/ingest/daily-study-log.js`) and this endpoint is unused.

---

<a id="sec-02"></a>

### SEC-02 — Outdated Next.js (14.2.35) with known critical/high advisories — **Resolved 2026-11-04**

- **Severity:** Resolved (was High)
- **Location:** `apps/web/package.json` (`next ^16.4.5`, installed `16.4.5`), `package-lock.json`
- **Description:** `next` was upgraded from `14.2.35` to `16.4.5` (React 19.3.1, `@types/react` 19.3.0, ESLint 9.39.5, `eslint-config-next` 16.4.5). The critical `next` advisory and the nested `postcss` advisory are cleared. Remaining `npm audit --omit=dev` findings are the Prisma family (`prisma`, `@prisma/config`, `deepmerge-ts`), which require a separate Prisma 7.10.1+ upgrade.
- **Impact:** Several advisories apply directly to how this app is built (App Router + many Server Actions + `next/image` with remote patterns). Some (Image Optimizer, custom-server SSRF, Windows RCE) are mainly relevant to self-hosted deployments; Vercel mitigates some at the platform layer. The app is a public site, so DoS on Server Actions is realistic.
- **Remediation (completed):**
   - ✅ Upgraded to `next@16.4.5`, React 19.3.1, ESLint 9.39.5, `eslint-config-next@16.4.5`; typecheck, lint, tests, and Turbopack build pass.
   - ⏳ Prisma-family advisories remain; track the Prisma 7.10.1+ upgrade separately.
   - Track `next-auth@5.0.0-beta.x` — it is a beta; pin and monitor its advisories.
   - Add automated dependency scanning (see SEC-19).

---

<a id="sec-03"></a>

### SEC-03 — In-memory rate limiting removed; delegated to an external limiter

- **Severity:** Mitigated (external limiter pending)
- **Location:** Rate limiting was removed from `apps/web` (`core/security/rate-limiter.ts` and `core/security/client-ip.ts` deleted). Call sites cleaned: `app/api/feedback/route.ts`, `features/feedback/api/feedback-attachments.actions.ts`, `features/ypt/api/ypt-claim.actions.ts`.
- **Description:**
   - The limiter was a process-local `Map`. On Vercel each invocation/instance has its own counters, cold starts reset them, and the map was unbounded, so it did not provide a reliable global limit.
   - `getClientIp()` trusted the first `X-Forwarded-For` value, which is client-controlled when a proxy appends.
   - Both helpers and all in-app rate-limit branches were removed rather than migrated; upstream YPT 429 classification remains unchanged.
- **Impact:** `POST /api/feedback` is unauthenticated and fans out to **Postgres, Discord, GitHub Issues and Jira** per request (plus the signed-upload actions hit Supabase Storage). Until the external limiter is live, these endpoints have no application-level throttle.
- **Remediation:**
   - Enforce limits at the platform/external layer (Vercel WAF/Firewall, Upstash Ratelimit, or a gateway) before this release is public.
   - Derive the client IP from the platform-trusted source only.
   - Add per-authenticated-user quotas for feedback and attachment uploads, and a global daily cap on outbound GitHub/Jira creations.
   - Track the external-limiter work separately; do not mark this fully resolved until it is live.

---

<a id="sec-04"></a>

### SEC-04 — Server Actions exposing data without authentication or ownership checks

- **Severity:** Medium
- **Location:**
   - `apps/web/features/trophies/api/trophy.actions.ts` — `getUserCompetitiveStatsAction(userId?)`, `getUserTrophyHistoryAction({ userId })`
   - `apps/web/features/wagers/api/wager.actions.ts` — `getChallengeWagersAction(challengeId)`
- **Description:** Every exported function in a `"use server"` file is a publicly callable POST endpoint. These three accept an arbitrary `userId`/`challengeId` and perform **no** session check (or, for the trophy actions, only require a session when `userId` is omitted). Anyone — including unauthenticated callers — can pass any ID.
- **Impact:** Disclosure of other users' competitive stats, full trophy transaction history, and every wager placed in a challenge (amounts and bettors). Even if some of this is displayed on public pages today, these actions bypass any future privacy rules (e.g. the friend-only logic in `participant-stats/domain/profile-privacy.ts` is enforced for `getChallengeSnapshotAction` but not here). IDs are CUIDs, so enumeration is limited but IDs appear in URLs and leaderboards.
- **Remediation:**
   - Decide the intended visibility, then enforce it in the action: require a session and either `userId === session.user.id` or the existing `canViewFullProfileHistory(...)` / admin check.
   - Make `getChallengeWagersAction` require a session (and enrollment or admin) or return only aggregates.
   - Adopt a convention/lint rule: every exported server action must call `requireSessionUser()`/`requireAdminUser()`/`requireDevUser()` or be explicitly annotated as public.

---

<a id="sec-05"></a>

### SEC-05 — Role model weaknesses (stale privileges, inconsistent sources of truth)

- **Severity:** Medium
- **Location:** `apps/web/core/auth/index.ts`, `apps/web/features/auth/data/user.repository.ts` (`syncUserRoleFromDiscord`), `apps/web/features/admin/api/user-directory.actions.ts` (`updateUserRoleAction`), `apps/web/features/auth/api/require-admin.ts`
- **Description:**
   1. **Stale admin rights:** Roles are synced from Discord only inside the `signIn` event. Sessions use the `database` strategy (Auth.js default max age is 30 days). A user removed from the Discord admin role keeps `ADMIN` in the DB — and therefore full admin authority (Law L5: override hours, adjust wallets, lock results, change roles) — until they next sign in.
   2. **Conflicting sources of truth:** `updateUserRoleAction` lets an admin set `ADMIN`/`PARTICIPANT` in the DB, but the next login re-derives the role from Discord and silently reverts it. `DEV` is additionally derived from the env list in the `session` callback.
   3. **Unrestricted peer demotion/promotion:** Any `ADMIN` can promote any user to `ADMIN` or demote any other admin — and a `DEV` user's DB role (the action does not exclude `DEV` targets, so a DEV can be overwritten to `PARTICIPANT`/`ADMIN` in the DB). Only self-demotion is blocked. There is no second-approver/step-up for these high-impact actions.
   4. `session` callback fires a fire-and-forget `prisma.user.update` on every request for DEV users whose DB role differs, with errors swallowed to a log.
- **Impact:** Privilege persistence after revocation, confused-deputy risk if an admin account is compromised (attacker can mint more admins), and unclear audit semantics.
- **Remediation:**
   - Re-validate Discord role membership on a schedule or on sensitive actions (cache for minutes, not days); reduce session `maxAge`/`updateAge` for privileged roles.
   - Pick one source of truth (Discord roles) and remove or clearly scope the manual role editor (e.g. allow only "revoke").
   - Block role changes targeting `DEV` users from non-DEV actors; require `DEV` to grant `ADMIN`.
   - Perform role fix-ups synchronously on sign-in only, not in the session callback.

---

<a id="sec-06"></a>

### SEC-06 — Plaintext Discord OAuth tokens in the DB; unencrypted full database backups

- **Severity:** Medium
- **Location:** `packages/database/prisma/schema.prisma` (`model Account`), `apps/web/core/auth/index.ts` (`signIn` event persists `access_token`, `refresh_token`, `id_token`), `apps/web/features/auth/data/discord-avatar.service.ts`, `apps/ypt-bot/src/backup/runner.js`
- **Description:**
   - Discord `access_token`/`refresh_token`/`id_token` are stored unencrypted in the `Account` table. The only consumer is the avatar-refresh feature, which needs just the `identify` scope.
   - `ypt-bot` runs `pg_dump` of the entire `public` schema (users, sessions, **account tokens**, wallets, feedback) and uploads it unencrypted to Supabase Storage using the **service-role key** (full-bypass key) which is present in the bot's environment. Dumps are retained 30 days.
   - Auth.js `Session.sessionToken` values are also in the dump (valid session tokens = account takeover if restored/leaked).
- **Impact:** A SQL injection, DB read replica leak, backup bucket misconfiguration (docs say "private", but this is not enforced in code — only `getBucket()` reachability is checked), or compromised service-role key exposes live bearer credentials for users' Discord accounts and live web sessions.
- **Remediation:**
   - Don't persist tokens you don't need: after the sign-in profile sync, drop `access_token`/`refresh_token`/`id_token` (or encrypt them at the application layer with a KMS-managed key). The avatar can be refreshed with the bot token (already implemented as the fallback).
   - Encrypt backups before upload (e.g. `age`/`gpg` with an offline key) and exclude `Session`/`Account` tables (`--exclude-table-data`).
   - In `preflight`, assert the bucket is `public === false` (the `getBucket` response includes it) and fail otherwise.
   - Use a dedicated least-privilege storage credential for the backup bot rather than the full service-role key, and a read-only DB role for `pg_dump`.

---

<a id="sec-07"></a>

### SEC-07 — Feedback attachments: unauthenticated, client-controlled Content-Type, public bucket

- **Severity:** Medium
- **Location:** `apps/web/features/feedback/api/feedback-attachments.actions.ts`, `apps/web/core/storage/supabase-storage.ts` (`createSignedStorageUpload`), `apps/web/features/feedback/data/feedback-attachment.storage.ts`
- **Description:**
   - `requestFeedbackAttachmentUploadAction` issues signed upload URLs to **anyone** (no session), limited only by the spoofable limiter (SEC-03). Declared size/MIME are validated server-side, but the real upload goes directly from the browser to Supabase: the object's `Content-Type` is whatever the client sends, and size is only checked after the fact in `confirm`/`submit`.
   - Verification sniffs only the first 32 bytes (`Range: bytes=0-31`). A polyglot file (valid PNG/GIF/MP4 header + HTML/JS body) can be stored with `Content-Type: text/html` and is then served from the public bucket URL.
   - Unverified/abandoned uploads are only deleted if the client calls `discard`, so unauthenticated users can fill the bucket.
- **Impact:** Stored content served from the Supabase project domain (not the app origin, so cookie theft is not direct, but it enables phishing/malware hosting under a trusted-looking domain and XSS on that origin); storage cost exhaustion; uploaded files are also embedded into Discord/GitHub/Jira, where staff will open them.
- **Remediation:**
   - Require login to upload (or CAPTCHA for guests) and apply per-user quotas.
   - Set bucket-level allowed MIME types and max file size in Supabase (`allowedMimeTypes`, `fileSizeLimit`), and serve with `Content-Disposition`/`X-Content-Type-Options: nosniff`.
   - After upload, re-check the stored object's `metadata.mimetype` equals the sniffed type; delete otherwise.
   - Add a scheduled job to delete unreferenced objects older than N minutes in `feedback-attachments/`.

---

<a id="sec-08"></a>

### SEC-08 — Unvalidated feedback fields injected into Discord / GitHub / Jira

- **Severity:** Medium
- **Location:** `apps/web/features/feedback/domain/feedback.schema.ts`, `features/feedback/data/discord-feedback.service.ts`, `features/feedback/domain/github-issue.ts`, `features/feedback/domain/jira-issue.ts`
- **Description:**
   - `url` is a free-form string (≤1024) and `logrocketSessionId` is a free-form string (≤1024) with no format checks. `logrocketSessionId` is interpolated into a Discord markdown link `[View Session Replay & Logs](${logrocketSessionId})` and into GitHub/Jira bodies. An anonymous submitter can place any URL (phishing, credential-harvesting, malware) behind a trusted-looking "Session Replay" link in the staff channel and issue tracker.
   - `title`/`description` are pushed verbatim into GitHub Markdown, so `@org/team`, `@user` and `#123` references cause notifications/cross-links (notification spam, mention abuse) and markdown/HTML injection in the issue body.
   - Reporter identity is rendered as `<@discordId>` (fine) but guest submissions are indistinguishable from real users apart from the label.
- **Impact:** Social-engineering of maintainers/admins, notification abuse, issue-tracker pollution.
- **Remediation:**
   - Validate `logrocketSessionId` against `^https://app\.logrocket\.com/…` (or just the session ID format) and `url` as a same-origin path/URL.
   - Neutralize mentions and auto-links in GitHub/Jira text (escape `@`, wrap description in a fenced block or blockquote).
   - Send Discord messages with `allowed_mentions: { parse: [] }` as a standing rule in `sendChannelMessage`.

---

<a id="sec-09"></a>

### SEC-09 — Raw error messages returned to clients

- **Severity:** Medium
- **Location:** Pervasive. Examples: `app/api/feedback/route.ts` (500 returns `error.message`), `features/wagers/api/wager.actions.ts`, `features/trophies/api/trophy.actions.ts`, `features/economy/api/wallet.actions.ts`, `features/challenges/api/enroll-participant.actions.ts`, `features/admin/api/user-directory.actions.ts`, `features/ypt/api/ypt-claim.actions.ts`, `apps/tasker/src/commands/yapperize.ts`
- **Description:** Many catch blocks return `error instanceof Error ? error.message : "..."` to the caller. Prisma, Supabase, Discord, GitHub, and Jira errors can contain table/column names, query fragments, internal hostnames, or upstream response bodies (the GitHub/Jira services also embed up to `ERROR_TEXT_MAX` characters of the upstream response in errors that flow back to the feedback route's logs/results).
- **Impact:** Information disclosure that aids further attacks (schema details, internal URLs, config state such as "X is not configured").
- **Remediation:** Return stable error codes + generic messages; log the real error server-side with a correlation ID. Only pass through messages from domain-defined, whitelisted error classes (e.g. `ChallengeStateError`). `classifyYptError(...).sanitizedMessage` in the YPT feature is a good pattern to generalize.

---

<a id="sec-10"></a>

### SEC-10 — No security response headers

- **Severity:** Medium
- **Location:** `apps/web/next.config.mjs` (no `headers()`), `apps/web/middleware.ts` (does not set any)
- **Description:** The app sets no `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. The app additionally loads third-party script (LogRocket) and one inline `<script dangerouslySetInnerHTML>` (`cockpit-tasks-section.tsx`, which is correctly JSON-escaped with `<` → `\u003c`, but will need a nonce/hash under a strict CSP).
- **Impact:** Clickjacking of the admin UI (destructive actions like "Lock Final Results", role changes), no defense-in-depth against any future XSS, MIME sniffing.
- **Remediation:** Add a `headers()` block (or middleware) with: `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and a nonce-based CSP (allow Supabase/Discord CDN for images and LogRocket for scripts/connect).

---

<a id="sec-11"></a>

### SEC-11 — Tasker `/yapperize`: permission and abuse issues

- **Severity:** Medium
- **Location:** `apps/tasker/src/commands/yapperize.ts`, `apps/tasker/src/lib/message-fetcher.ts`, `apps/tasker/src/lib/summarizer.ts`, `apps/tasker/src/index.ts`
- **Description:**
   1. **Fail-open permission check:** `if (userPerms && !userPerms.has("ViewChannel"))` — when `permissionsFor(interaction.user)` returns `null`/`undefined` (user not in cache or not resolvable as a guild member), the check is skipped and the bot (which typically has broad access) summarizes the channel. The check also requires only `ViewChannel`, not `ReadMessageHistory`, so a user who can see a channel but is denied history can still obtain a summary of historical messages. Use `interaction.memberPermissions`/`channel.permissionsFor(interaction.member)` and fail closed.
   2. **Public output:** the summary is posted with a normal `editReply` (visible to the whole channel it is invoked in), so a user can summarize channel A (visible to them) and post it into a public channel B, potentially leaking content from a restricted audience. Consider ephemeral replies or requiring the invoking channel to be the target.
   3. **No cooldown/quota:** each invocation scans up to 500 messages and calls Gemini, rotating across up to three API keys on 429. Any member can exhaust the keys/quota (cost and availability).
   4. **Prompt injection:** message text (including `.txt` attachments) is passed to the LLM; attackers can steer or poison the summary.
   5. **Unbounded attachment fetch:** `sanitizeMessage` calls `fetch(att.url)` + `res.text()` for every `.txt` attachment and only truncates _after_ downloading the whole body; no size/timeouts. 500 messages × large files is a memory/DoS risk. `att.url` comes from Discord (trusted host), so SSRF is not a concern.
   6. **Data egress:** channel content (potentially private/staff channels) is sent to a third-party (Google Gemini). This should be a documented, consented decision.
   7. Error text (`err.message`) is shown to users (see SEC-09).
- **Remediation:** Fail closed on missing member permissions and require both `ViewChannel` and `ReadMessageHistory`; add per-user and per-guild cooldowns; make replies ephemeral by default; cap attachment size (check `att.size`, stream with a byte limit, add timeouts); set `allowedMentions: { parse: [] }`; document the Gemini data flow and optionally exclude configured private channels.

---

<a id="sec-12"></a>

### SEC-12 — `/api/users/sync-avatar` lacks authorization on the target user

- **Severity:** Low
- **Location:** `apps/web/app/api/users/sync-avatar/route.ts`, `apps/web/features/auth/data/discord-avatar.service.ts`
- **Description:** Any authenticated user may pass any `userId` or `discordId`. The OAuth token path is correctly gated (`allowOAuth` only for self), but the bot-API path will still call Discord's REST API and **write** the target user's `image` column. There is no rate limit or admin check, and the response (`newImageUrl`, `"User not found"`) lets a caller confirm whether a Discord ID has an account on the platform and fetch its avatar URL.
- **Impact:** Per-request Discord REST amplification (bot token rate-limit exhaustion → affects feedback delivery and role sync, since they share the bot token), and low-grade user enumeration.
- **Remediation:** Restrict `userId`/`discordId` targets to the caller unless `hasAdminPrivileges(role)`; add per-user rate limiting; don't distinguish "not found" for non-admins.

---

<a id="sec-13"></a>

### SEC-13 — `referenceUrl` accepts any URL scheme (verify)

- **Severity:** Low
- **Location:** `apps/web/features/pokemon/domain/pokemon.schema.ts` (`referenceUrl: z.string().url()...`), rendered at `features/pokemon/presentation/pokemon-detail-modal.tsx` as `<a href={species.referenceUrl}>`
- **Description:** `z.string().url()` validates that the string parses as a URL, not that its scheme is `http(s)`. Depending on the Zod version's behavior, `javascript:`/`data:` URLs may pass and would be rendered as a clickable link. The writer is admin-only (`adminUpsertPokemonSpeciesAction`) and `rel="noopener noreferrer"` is set, so exploitation requires a malicious/compromised admin or a seed-data source — hence Low.
- **Remediation:** Constrain with `z.url({ protocol: /^https?$/ })` (Zod 4) or a refine on `new URL(v).protocol`, and re-validate at render time (as `challenge-description.ts` already does with its `https?://` regex).

---

<a id="sec-14"></a>

### SEC-14 — Authentication bypass switch for admin routes tied to `NODE_ENV`

- **Severity:** Low
- **Location:** `apps/web/middleware.ts`, `apps/web/app/admin/layout.tsx`, `apps/web/app/devboard/layout.tsx`
- **Description:** When `NODE_ENV === "development"` **and** (`ALLOW_DEV_BYPASS=true` **or** `AUTH_DISCORD_ID` is unset), the admin/devboard shells render without a session. Server Actions still call `requireAdminUser()`/`requireDevUser()` (so data-modifying operations remain protected), but server-rendered admin pages that read data directly would be exposed if any deployment accidentally runs with `NODE_ENV=development` (e.g. `next dev` on a staging box).
- **Remediation:** Remove the bypass, or require an explicit opt-in env var that is rejected when `VERCEL_ENV`/`CI`/a public hostname is detected. At minimum, never infer the bypass from a _missing_ `AUTH_DISCORD_ID`.
- **Related note (Info):** `middleware.ts` only checks that a session cookie _exists_; that is documented and acceptable because layouts/actions perform the real check, but it means middleware must never be relied upon as the sole gate.

---

<a id="sec-15"></a>

### SEC-15 — `docker-compose.yml` Postgres with default credentials, exposed on all interfaces

- **Severity:** Low (dev-only asset, but easy to misuse)
- **Location:** `docker-compose.yml`
- **Description:** `POSTGRES_USER/PASSWORD=postgres/postgres`, port mapping `"5433:5432"` binds to `0.0.0.0` by default.
- **Impact:** On a developer laptop on a shared network (or a cloud VM used for staging) the DB is reachable with a well-known password.
- **Remediation:** Bind to loopback (`"127.0.0.1:5433:5432"`), read the password from an untracked `.env`, and add a comment that this file is development-only.

---

<a id="sec-16"></a>

### SEC-16 — Container hardening gaps

- **Severity:** Low
- **Location:** `apps/ypt-bot/Dockerfile`, `apps/tasker/Dockerfile`, `.dockerignore`, `packages/discord/src/bot/health.ts`, `apps/ypt-bot/src/http/health-server.js`
- **Description:**
   - Both containers run as **root** (no `USER`).
   - `COPY . .` copies the whole monorepo (web sources, docs, `.git` excluded). `.dockerignore` excludes `**/.env` and `.env*.local` but **not** other variants such as `.env.production` / `.env.staging`.
   - `ypt-bot` adds the PostgreSQL apt repo over `http://` and downloads the signing key with `curl` without pinning a fingerprint.
   - `npm ci` installs devDependencies and the tasker runs through `tsx` in production.
   - Health servers listen on `0.0.0.0` and expose uptime (low sensitivity).
- **Remediation:** Add a non-root `USER node`; broaden `.dockerignore` to `**/.env*` except `.env.example`; use `https://` apt URL and verify the key fingerprint (or use the Debian `postgresql-client` / a pinned image); use multi-stage builds with `npm ci --omit=dev`; bind health servers to an internal interface where possible.

---

<a id="sec-17"></a>

### SEC-17 — Failed backup leaves plaintext dump on disk

- **Severity:** Low
- **Location:** `apps/ypt-bot/src/backup/runner.js` (`finally` block)
- **Description:** When a run fails before `stored = true`, the temp directory is intentionally retained (`backup_files_retained`) and never cleaned. Each failure leaves a full unencrypted dump in `os.tmpdir()`; repeated failures (e.g. oversized dump >50 MiB, a likely future condition the code already acknowledges) accumulate sensitive data and fill the disk.
- **Remediation:** Always delete the temp directory (the dump is reproducible); or retain only the last failure with `0600` permissions and a TTL.

---

<a id="sec-18"></a>

### SEC-18 — LogRocket session replay with default privacy settings

- **Severity:** Low
- **Location:** `apps/web/core/observability/logrocket.ts`, `logrocket-config.ts`
- **Description:** `LogRocket.init(appId, { release })` is called with no `dom.inputSanitizer`, `network.requestSanitizer`/`responseSanitizer`, or element-blocking classes. It also calls `identify(userId, { name, role, discordId })`. Session replays therefore capture feedback text, study-log values, admin override reasons, and Server Action payloads/responses (including the role-management and wallet screens for admins). The app ID is hard-coded as a fallback in source.
- **Remediation:** Enable `inputSanitizer: true`, add network sanitizers (strip bodies for `/api/*` and Server Action POSTs), block admin/devboard routes from recording, and make sure the privacy notice discloses recording. Prefer opaque user IDs over `discordId`.

---

<a id="sec-19"></a>

### SEC-19 — CI/supply-chain hygiene

- **Severity:** Low
- **Location:** `.github/workflows/ci.yml`, `.github/CODEOWNERS`
- **Description:**
   - CI runs typecheck/lint/tests/build but **no** `npm audit`, secret scanning, CodeQL/SAST, or dependency review; this is how SEC-02 went unnoticed.
   - `actions/checkout@v4` and `actions/setup-node@v4` are pinned to mutable tags, not commit SHAs. No `permissions:` block is set (defaults to the repository default token scope).
   - `CODEOWNERS` is a single owner (`* @Afnanpathan2004`); security-critical paths (`core/auth`, `features/auth`, `prisma/`, `.github/`) have no second reviewer.
   - Husky `prepare` uses `|| true`, so hooks silently skip.
- **Remediation:** Add `permissions: contents: read`, pin actions by SHA, enable Dependabot/Renovate, `npm audit --omit=dev --audit-level=high`, CodeQL, and GitHub secret scanning/push protection; add CODEOWNERS entries and branch protection requiring review for auth/DB/CI paths.

---

<a id="sec-20"></a>

### SEC-20 — Auth.js host trust / cookie configuration is implicit (verify)

- **Severity:** Low
- **Location:** `apps/web/core/auth/index.ts`
- **Description:** No `trustHost`, explicit `cookies`, or `session.maxAge` settings. On Vercel `AUTH_URL`/host trust is auto-detected; on any other host Auth.js v5 will either refuse requests or (if `AUTH_TRUST_HOST=true` is set carelessly) trust the `Host`/`X-Forwarded-Host` header. The default 30-day session lifetime also amplifies SEC-05.
- **Remediation:** Document and pin `AUTH_URL` for production, avoid blanket `AUTH_TRUST_HOST`, and set a shorter `session.maxAge`/`updateAge`.

---

<a id="sec-21"></a>

### SEC-21 — Positive controls observed (no action needed)

These reduce risk and should be preserved:

- **Secrets hygiene:** `.env` files git-ignored and untracked; `.env.example` uses placeholders; `/backups/` ignored.
- **AuthZ on mutating actions:** All admin/dev server actions call `requireAdminUser()`/`requireDevUser()` server-side (not just in middleware); ownership is enforced via `requireOwnedParticipant`, `userId`-scoped Prisma `where` clauses in the task-sync repository and Tasker models, and an admin check for cross-user wallet reconciliation.
- **Economy integrity:** Wallet, wager, reward, and Pokémon acquisition flows run in `Serializable` transactions with idempotency keys and an append-only ledger.
- **SQL injection:** Only tagged-template `$queryRaw` with parameter binding is used (`FOR UPDATE` row locks); no `$queryRawUnsafe`/string-built SQL.
- **Upload validation:** Banner/punishment images are validated by magic bytes (not client MIME/extension), stored under random UUID names in fixed folders, with `upsert: false`; cleanup is restricted to managed paths (`extractManagedObjectPath`).
- **Rendering safety:** No user-controlled `dangerouslySetInnerHTML`; challenge description uses a constrained parser that only allows `http(s)://` and `/` links with `rel="noreferrer noopener"`; the single inline script is JSON-escaped.
- **Input validation:** Zod schemas on API boundaries, bounded durations (≤ 24 h), date format checks, future-date rejection on ingest.
- **Admin accountability:** Admin overrides write audit events with `isOverride`/actor IDs; self-demotion is blocked.
- **Child processes:** The backup runner uses `spawn` with an argument array (no shell), and passes the DB password via `PGPASSWORD` env rather than argv.
- **Image config:** `next/image` remote patterns are limited to specific hosts.

---

## 4. Recommended Remediation Order

1. **Immediately:** SEC-01 (fail-closed ingest key), confirm `YPT_INGEST_API_KEY` is set in every environment and rotate it.
2. **This sprint:** ✅ SEC-02 (upgraded to Next.js 16.4.5), SEC-04 (auth on exposed read actions), SEC-03 (external/platform rate limiter + trusted IP source), SEC-10 (security headers).
3. **Next sprint:** SEC-05 (role revalidation/session lifetime), SEC-06 (token + backup encryption, bucket assertion), SEC-07/08/09 (feedback hardening, error sanitization), SEC-11 (Tasker `/yapperize`).
4. **Backlog:** SEC-12 – SEC-20 hardening items; add CI scanning (SEC-19) so regressions of this class are caught automatically.

---

## 5. Reporting a Vulnerability

Please do **not** open a public GitHub issue for security problems. Contact the maintainer privately (see `.github/CODEOWNERS`) via GitHub Security Advisories ("Report a vulnerability" on the repository's Security tab) or a direct message on the project's Discord. Include reproduction steps, affected component/path, and impact. Expect an acknowledgement within a few days.

---

## 6. Audit Limitations

This report reflects a point-in-time static review. It may not include all issues, and several findings depend on deployment configuration (hosting platform, proxy behavior, Supabase bucket/RLS policy, Discord permissions) that was not available. Re-audit after the High/Medium items are remediated and before any production launch of the economy/wager features, since they handle in-app value.
