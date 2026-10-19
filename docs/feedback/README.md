# Feedback & Bug Reporting

> **Scope:** In-app feedback intake (bug reports + enhancement suggestions), Discord dispatch, and bug-report media attachments.
> **Feature ID:** `FEAT-FEED-01`
> **Authority:** `FEATURES.md` §13, `AGENTS.md` §2 (feature-first slices) and Law L7.

---

## 1. Executive Summary & Scope

The floating feedback button (global in `app/layout.tsx`) opens a dialog that accepts:

- **Bug reports** — category, title, description, auto-captured route, LogRocket session URL, and up to **3 image/video attachments**.
- **Suggestions** — category, title, description, route, and LogRocket session URL (text only).

Every submission is persisted to PostgreSQL first (source of truth), assigned a sequential `FB-N` code, then dispatched to Discord, GitHub, and Jira as fail-soft side effects (GitHub and Jira only when configured). Attachments live in the public Supabase Storage bucket under `feedback-attachments/`, and their validated object paths are linked through `FeedbackAttachment` rows.

**Architectural guardrails**

- `domain/` stays pure (Law L7): limits, MIME maps, magic-byte sniffing, and path parsing are framework-free.
- Uploads never flow through a Next.js server action body. Vercel caps request bodies at ~4.5 MB; signed direct uploads keep 50 MB videos viable.
- The server never trusts client-declared URLs or MIME types. Object existence, size, and magic bytes are re-checked after upload and again at submit.
- Feedback never blocks on Discord; storage/discord failures degrade gracefully and are logged.

### 1.1 Allowed media

| Kind  | MIME types                                           | Extensions                  | Max size |
| ----- | ---------------------------------------------------- | --------------------------- | -------- |
| Image | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | `png`, `jpg`, `webp`, `gif` | 5 MB     |
| Video | `video/mp4`, `video/webm`, `video/quicktime`         | `mp4`, `webm`, `mov`        | 50 MB    |

Maximum **3 files** per bug report.

---

## 2. Domain State Machine & Decisions

### 2.1 Upload lifecycle (client)

```
selected
  ├─ local metadata invalid ──► error (no upload)
  └─ valid
       ├─ request signed URL (rate limited)
       ├─ XHR PUT to Supabase (progress)
       ├─ status: verifying
       └─ confirm (server verifies object)
            ├─ valid   ──► ready   (path + public URL stored in draft)
            └─ invalid ──► error   (object deleted server-side; user can retry)
```

Only `ready` drafts are submitted. Submitting is blocked while any draft is `uploading`/`verifying`, or while an `error` draft remains. Removing a draft (or closing the dialog without submitting) calls the discard action; submitted paths are never discarded.

### 2.2 Server verification decision table

| Check                                                        | Rejection behavior                                 |
| :----------------------------------------------------------- | :------------------------------------------------- |
| Path shape (`<folder>/<uuid>.<ext>`, allow-listed extension) | `null` (no storage call for unmanaged paths)       |
| Object exists (`storage.info`)                               | `null`                                             |
| `0 < size <= per-kind cap`                                   | `null`                                             |
| Range GET returns `206`                                      | `null`                                             |
| Magic bytes match the path extension                         | `null`                                             |
| Otherwise                                                    | Returns `{ path, url, kind, mimeType, sizeBytes }` |

`POST /api/feedback` repeats every check and rejects the whole submission if any path fails (best-effort deletes the offending managed object). Attachments are rejected outright when `type === "enhancement"`.

### 2.3 Key decisions

- **Signed direct uploads** instead of proxying bytes through Next (Vercel request ceiling).
- **Paths, not URLs, are submitted.** The public URL is derived server-side from the configured bucket/folder.
- **First image is embedded inline in Discord; videos are links.** Discord cannot inline-play arbitrary video URLs without a multipart file upload.
- **MOV is allowed** for iPhone camera-library uploads; it is treated as a video link.

### 2.4 Delivery dispatch (Discord + GitHub + Jira)

After the feedback row is committed, all side effects run in parallel and none may fail the submission:

```
Promise.allSettled([
  sendFeedbackToDiscord(...),
  createGitHubIssue(...),
  createJiraIssue(...),
])
  → updateFeedbackDiscordStatus(SENT | FAILED)
  → updateFeedbackGitHubStatus(CREATED | FAILED | SKIPPED)
  → updateFeedbackJiraStatus(CREATED | FAILED | SKIPPED)
  → 201 { ..., discordDelivered, githubDelivered, githubIssueUrl,
             jiraDelivered, jiraIssueKey, jiraIssueUrl }
```

GitHub enablement is env-driven: `GITHUB_TOKEN` + `GITHUB_REPO` must both be present. Without them the result is `SKIPPED` and no request is made. A GitHub `422` (usually a missing label) triggers one retry without labels. There is no automatic retry after that; failures are recorded on the row for a future manual retry.

Jira enablement requires `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`. Bugs map to `Task`, suggestions to `Story`. There is no automatic retry; failures are recorded.

GitHub issue body:

- Hidden marker `<!-- holdmetoit-feedback:FB-N -->` for future dedupe/search.
- Type, page, reporter, and LogRocket link.
- Description.
- Attachments: `![Image N](url)` for images (GitHub renders them inline) and `[Video N](url)` for videos.

Jira description (ADF):

- Plain marker paragraph `holdmetoit-feedback:FB-N`.
- Type, page, reporter, and LogRocket link.
- Description paragraphs.
- Attachments as a bullet list of links (Jira does not render remote images inline).

---

## 3. Database Persistence Models

```prisma
model Feedback {
  // ...
  discordStatus DiscordDeliveryStatus @default(PENDING)
  // ...
  githubStatus      GitHubDeliveryStatus @default(PENDING)
  githubIssueNumber Int?
  githubIssueUrl    String?              @db.VarChar(2048)
  githubSyncedAt    DateTime?

  jiraStatus     JiraDeliveryStatus @default(PENDING)
  jiraIssueKey   String?            @db.VarChar(64)
  jiraIssueUrl   String?            @db.VarChar(2048)
  jiraSyncedAt   DateTime?

  attachments FeedbackAttachment[]
}

enum GitHubDeliveryStatus {
  PENDING
  CREATED
  FAILED
  SKIPPED
}

enum JiraDeliveryStatus {
  PENDING
  CREATED
  FAILED
  SKIPPED
}

model FeedbackAttachment {
  id         String                 @id @default(cuid())
  feedbackId String
  url        String                 @db.VarChar(2048)
  path       String                 @db.VarChar(512)
  kind       FeedbackAttachmentKind
  mimeType   String                 @db.VarChar(128)
  sizeBytes  Int
  sortOrder  Int                    @default(0)
  createdAt  DateTime               @default(now())

  feedback   Feedback               @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, path])
  @@index([feedbackId, sortOrder])
}

enum FeedbackAttachmentKind {
  IMAGE
  VIDEO
}
```

- Rows are created with the parent feedback via a nested `create`.
- `path` is the storage key (`feedback-attachments/<uuid>.<ext>`); `url` is the public URL at creation time.
- `sortOrder` preserves the user's selection order.
- Deleting a `Feedback` cascades to its attachments.
- Migration: `packages/database/prisma/migrations/20261019000000_add_feedback_attachments`.

> **Known drift (D5):** the `Feedback` table itself predates migrations (created with `db push`). This migration only adds the attachment objects and assumes `Feedback` exists. Fresh databases still require the documented `prisma db push` catch-up.

---

## 4. Developer & Operator Usage Guide

### 4.1 Client components

```tsx
import {
   FeedbackAttachmentInput,
   type DraftFeedbackAttachment,
} from "@/features/feedback/presentation/feedback-attachment-input";

const [attachments, setAttachments] = useState<DraftFeedbackAttachment[]>([]);

<FeedbackAttachmentInput
   attachments={attachments}
   onChange={setAttachments}
   disabled={isSubmitting}
/>;
```

Submit only verified paths:

```ts
const paths = attachments
   .filter((a) => a.status === "ready" && a.path)
   .map((a) => a.path as string);

await fetch("/api/feedback", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
      type: "bug",
      title,
      description,
      url,
      attachments: paths,
   }),
});
```

### 4.2 Server actions

`features/feedback/api/feedback-attachments.actions.ts`

```ts
requestFeedbackAttachmentUploadAction({ mimeType, sizeBytes });
// → { ok: true, data: { path, token, signedUrl, publicUrl } }

confirmFeedbackAttachmentAction({ path });
// → { ok: true, data: VerifiedFeedbackAttachment }

discardFeedbackAttachmentAction({ path });
// → { ok: true } (idempotent; never deletes a persisted attachment)
```

All three are unauthenticated (feedback supports guests) and rate-limited per IP (30 requests / 10 minutes). They return discriminated results; they never throw across the action boundary.

### 4.3 Storage helpers

`core/storage/supabase-storage.ts`

```ts
createSignedStorageUpload({ folder, ext }); // service-role signed PUT URL
getStorageObjectInfo(path); // { sizeBytes, contentType } | null
getStoragePublicUrl(path); // public URL
deleteStorageObject(path); // fail-soft delete
getFeedbackAttachmentsUrlConfig(); // { supabaseUrl, bucket, folder }
```

Browser upload (XHR is used so progress events are available):

```ts
import { uploadFeedbackAttachment } from "@/features/feedback/presentation/upload-feedback-attachment";

const verified = await uploadFeedbackAttachment(file, {
   onProgress: (percent) => console.log(percent),
   onUploaded: () => console.log("verifying"),
});
```

### 4.4 Environment

| Variable                               | Required | Default                                   |
| :------------------------------------- | :------: | :---------------------------------------- |
| `SUPABASE_URL`                         |   yes    | —                                         |
| `SUPABASE_SERVICE_ROLE_KEY`            |   yes    | —                                         |
| `SUPABASE_STORAGE_BUCKET`              |   yes    | `holdmetoit-bucket` (template value)      |
| `SUPABASE_FEEDBACK_ATTACHMENTS_FOLDER` |    no    | `feedback-attachments`                    |
| `GITHUB_TOKEN`                         |    no    | — (GitHub sync disabled when absent)      |
| `GITHUB_REPO`                          |    no    | — (`owner/repo`; required with the token) |
| `GITHUB_ISSUE_LABELS_BUG`              |    no    | `bug`                                     |
| `GITHUB_ISSUE_LABELS_ENHANCEMENT`      |    no    | `enhancement`                             |
| `GITHUB_ISSUE_ASSIGNEES`               |    no    | —                                         |
| `GITHUB_API_URL`                       |    no    | `https://api.github.com`                  |
| `JIRA_BASE_URL`                        |    no    | — (Jira sync disabled when absent)        |
| `JIRA_EMAIL`                           |    no    | — (required with the token)               |
| `JIRA_API_TOKEN`                       |    no    | — (required with the email)               |
| `JIRA_PROJECT_KEY`                     |    no    | — (required to enable Jira sync)          |
| `JIRA_LABELS`                          |    no    | `holdmetoit,feedback`                     |
| `JIRA_ASSIGNEE_ACCOUNT_ID`             |    no    | —                                         |

### 4.5 Supabase setup checklist

1. Bucket `holdmetoit-bucket` exists and is **public** (challenge images already depend on this).
2. Per-object size limit is **≥ 50 MB**.
3. Storage CORS allows `PUT` from the web origin (Supabase's default is `*`).
4. No explicit folder creation is needed; `feedback-attachments/` appears on first upload.

### 4.6 Manual verification

1. Open the feedback dialog → Bug Report → attach a PNG and a short MP4. Preview and progress render.
2. Confirm objects exist under `holdmetoit-bucket/feedback-attachments/<uuid>.<ext>`.
3. Submit; verify `FeedbackAttachment` rows and the Discord message (inline image + link list).
4. Remove a `ready` draft; the object disappears from Storage.
5. Switch to Suggestion; the attachment UI is hidden.
6. Attempt >5 MB image / >50 MB video / unsupported type; each is rejected locally.
7. Tamper with a submitted path in DevTools; the route returns 400 and creates no row.
8. Check the dialog at 360 px: no horizontal overflow and tappable controls.
9. With GitHub env configured, submit a bug → issue created with the `bug` label and a `holdmetoit-feedback:FB-N` marker.
10.   Submit a bug with an image and a video → the image renders inline in the issue, the video appears as a link.
11.   Invalidate the token → the submission still returns 201 and the row records `githubStatus = FAILED`; Discord still delivers.
12.   Remove `GITHUB_TOKEN` → the row records `githubStatus = SKIPPED` and no GitHub request is made.
13.   With Jira env configured, submit a bug → a `Task` issue is created with `[FB-N] ...`, the `holdmetoit-feedback:FB-N` marker, and the configured labels.
14.   Submit a suggestion → a `Story` issue with the `enhancement` label.
15.   Submit a bug with an image and a video → both appear as links in the Jira description (no inline media).
16.   Invalidate the API token → submission still returns `201`; the row records `jiraStatus = FAILED`; Discord and GitHub still deliver.
17.   Remove `JIRA_API_TOKEN` → the row records `jiraStatus = SKIPPED` and no Jira request is made.

### 4.7 GitHub issue sync setup

1. Create a **fine-grained PAT** scoped to the single target repository with **Issues: Read and write**.
2. Set `GITHUB_TOKEN` and `GITHUB_REPO="owner/repo"` in the server environment (never `NEXT_PUBLIC_`).
3. Ensure the `bug` and `enhancement` labels exist in the repository. If a label is missing, GitHub returns 422 and the service retries once without labels.
4. Optionally set `GITHUB_ISSUE_ASSIGNEES` (comma-separated logins) and override the label lists.
5. Choose a PAT expiration and rotate it before it lapses. A lapse surfaces as `githubStatus = FAILED` on new feedback; older rows are unaffected.

### 4.8 Jira issue sync setup

1. Create an API token at `id.atlassian.com` for the account that will own the tickets.
2. Set `JIRA_BASE_URL` (e.g. `https://your-site.atlassian.net`), `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY` in the server environment.
3. Ensure the project's issue-type scheme contains **Task** and **Story** (the mapping is fixed).
4. Optionally set `JIRA_LABELS` (defaults to `holdmetoit,feedback`) and `JIRA_ASSIGNEE_ACCOUNT_ID`.
5. If the project requires custom fields on issue creation, add them to the request/fields or Jira returns `400`; the logged `errors` object names the missing field.
6. Rotate the API token before it expires. A lapse surfaces as `jiraStatus = FAILED` on new feedback.

---

## 5. Security & Authorization Rules

- **Anonymous uploads are allowed** by product design; abuse is mitigated with per-IP rate limits (`feedback-upload`, `feedback-confirm`, `feedback-discard`) and hard size/type caps.
- **No client trust:** MIME and extension are derived from magic bytes; the submitted `path` must match the configured folder and an allow-listed extension.
- **Signed URLs are short-lived** and single-object (`upsert: false`); the service-role key never reaches the browser.
- **Discard is reference-guarded:** `isFeedbackAttachmentReferenced(path)` prevents deletion once a `FeedbackAttachment` row exists.
- **No path traversal:** path parsing rejects nesting, `..`, query strings, fragments, and look-alike hosts.
- **Data access:** the Supabase bucket is public for reads (needed for Discord and previews); writes require the service-role-signed URL.
- **GitHub token:** stored server-side only, scoped to a single repository, and never logged, returned, or bundled into client code. Issue content is user-supplied markdown; GitHub itself sanitizes rendered HTML. @mentions only notify accounts with repository access.
- **Jira credentials:** the API token and email are server-only, used solely for Basic auth against the configured Jira Cloud site, and never logged, returned, or bundled into client code.

Known limitation: the rate limiter is in-memory per serverless instance (same as the existing feedback route).

---

## 6. Feature Lifecycle & Decommissioning

1. **Dormant deploy** — schema and actions can ship without UI exposure; no jobs or cron.
2. **Targeted beta** — gate the `FeedbackAttachmentInput` render behind a feature flag if narrower rollout is needed (no dedicated flag exists today; reuse the DevBoard mechanism).
3. **Global GA** — current state; bug reports only.
4. **Decommission & prune** — remove the UI first, keep the actions read-only for a release, then delete `feedback-attachments/` objects, drop the `FeedbackAttachment` table via migration, and remove the folder env var. Remove `GITHUB_TOKEN`/`GITHUB_REPO` (and `JIRA_*` credentials) to stop issue creation independently; the `Feedback.github*` / `Feedback.jira*` columns can stay for historical audit. Feedback rows remain valid without attachments.

**Orphan cleanup:** removal/close/discard handles the common cases. If an upload completes after the tab closes, the object may linger. A future sweeper can list `feedback-attachments/` and delete objects with no matching `FeedbackAttachment.path`; feedback rows are never deleted by this feature.
