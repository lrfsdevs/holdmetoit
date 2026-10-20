# Challenge Overview Description (Custom Syntax)

## 1. Executive Summary & Scope

The challenge overview body is host-authored with a small, dependency-free parser. The
intro, `How it works`, and `Prizes & Rewards` sections all live in the existing
`Challenge.description` column. The `Welcome to the {challenge.title}!` heading remains
derived from the title.

- **Parser / resolver:** `apps/web/features/challenges/domain/challenge-description.ts` (pure, Law L7)
- **Renderer:** `apps/web/features/challenges/presentation/challenge-description-content.tsx`
- **Editor:** `apps/web/features/challenges/presentation/challenge-description-editor.tsx`
- **Public surface:** `apps/web/features/challenges/presentation/challenge-overview-tab.tsx`
- **Admin surfaces:** `challenge-creator-wizard.tsx`, `challenge-manage-tab.tsx`

No Markdown dependency, no new table, no JSON column, and no migration.

## 2. Supported Grammar

The parser is line-based and intentionally minimal:

| Input                          | Result              |
| :----------------------------- | :------------------ |
| `# Heading`                    | Level 1 heading     |
| `## Subheading`                | Level 2 heading     |
| `---` on its own line          | Horizontal divider  |
| `[label](https://example.com)` | External link       |
| `[label](/challenge/123)`      | Root-relative link  |
| Blank line                     | Paragraph separator |
| Any other line                 | Plain text          |

- Consecutive non-blank lines form one paragraph; single newlines render as `<br/>`.
- Only `http(s)` and root-relative `/` links become anchors. Other URLs (including
  `javascript:`) remain literal text.
- Raw HTML is escaped as text. There is no `dangerouslySetInnerHTML` path.
- Unsupported Markdown (`- lists`, `**bold**`, `###`, tables, code blocks) is shown literally.
- URLs containing `)` are not supported by the minimal link pattern.

## 3. Default Content & Fallback

`DEFAULT_CHALLENGE_DESCRIPTION` is the previous hardcoded copy expressed in this syntax:

```txt
An automated study battle governed by the HoldMeToIt three-condition accountability system. ...

# How it works

1. Make sure you are in the [Yeolpumta (YPT) group](https://link.yeolpumta.com) because hours are verified to the second.
2. Register and declare your mandatory target hours and weekly milestone intentions.
3. Participants are divided fairly into competing houses. Cumulative team scores update live with every logged session.
4. The team that falls behind, or any individual scholar who fails their declared hours or declared goals, wears the assigned forfeit PFP for one week.

---

# Prizes & Rewards

The winning house earns special shiny Discord roles and custom highlight badges for top contributors. Scholars who maintain commitments preserve their standard avatar honor.
```

A null, empty, or whitespace-only `description` resolves to this template via
`resolveChallengeDescription()`.

## 4. Editor

`ChallengeDescriptionEditor` provides:

- **Preview** and **Write** tabs; Preview is the default.
- A 5,000-character counter matching the Zod limit.
- `break-words` on the textarea so long URLs wrap instead of scrolling horizontally.
- A helper line: `# Heading · ## Subheading · --- divider · [label](https://...) link`.
- Tab buttons use `type="button"` so they never submit the form.

Both the creation wizard and the Manage tab use the same component. Saving behavior is
unchanged (`description.trim() || undefined`; the repository stores `null` for blanks).

## 5. Database & API

- `Challenge.description` (`String? @db.Text`) already exists and is already mapped into
  `ChallengeScoreboardViewModel.description`.
- `createChallengeSchema` / `updateChallengeSchema` keep the 5,000-character limit.
- Audit diffs (`computeEventDetailsDiff`) are unchanged.
- No migration or seed change is required.

## 6. Security

- Links are only created for `http://`, `https://`, and `/` prefixes.
- External links get `target="_blank"` and `rel="noreferrer noopener"`.
- All text is rendered as React text nodes; HTML tags are escaped, never interpreted.
- Admin-only authorization for creation/editing is unchanged (`requireAdminUser`).

## 7. Tests & Verification

Focused suites:

- `features/challenges/domain/challenge-description.test.ts`
- `features/challenges/presentation/challenge-description-content.test.tsx`
- `features/challenges/presentation/challenge-description-editor.test.tsx`
- `features/challenges/presentation/challenge-overview-tab.test.tsx`

```bash
npm run typecheck:web
npm run test:web
npm run build:web
```

Manual checks:

1. Create a challenge with the default template → overview renders headings, divider, and the YPT link.
2. Edit with `#`, `##`, `---`, and a link → Preview and the public overview match.
3. Clear the description → default template returns.
4. Paste `<script>` or a `javascript:` link → escaped text / no unsafe href.
5. Verify the editor opens on Preview and toggles to Write.
6. Check a 360px viewport and the existing overview loading/empty/error states.
