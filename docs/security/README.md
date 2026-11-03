# Security & Client Error Sanitization Architecture

> **Feature Scope:** SEC-09 / GitHub Issue #231 (`KAN-86`)  
> **Layer:** `core/errors/` (Web) & `src/lib/error-sanitizer.ts` (Tasker)  
> **Laws Governed:** Law L7 (Pure Domain Isolation), Law L9 (Zero-State & Error Resilience)  
> **Last Updated:** 2026-11-03

---

## 1. Overview & Threat Model

Prior to this implementation, several server actions, route handlers, and Tasker bot commands exposed raw `error.message` strings directly to callers (`error instanceof Error ? error.message : "..."`).

### The Threat

Unhandled exceptions originating from:

- **Prisma ORM / PostgreSQL**: Leaking connection strings (e.g. `postgres://user:password@internal-db:5432/hmt`), raw SQL queries, database table schemas, foreign key names, and constraint identifiers.
- **Supabase Storage**: Leaking bucket endpoints, bearer tokens, or internal storage object paths.
- **Discord API / Webhooks**: Leaking Discord guild IDs, channel IDs, webhook URLs, and rate limit bucket states.
- **Upstream Integrations (GitHub, Jira, Yeolpumta)**: Leaking personal access tokens, Jira workspace URLs, and API response payloads.

---

## 2. Architecture & Design Principles

```mermaid
flowchart TD
    E[Caught Exception / Unknown Error] --> C{isDomainError?}
    C -- Yes (Whitelisted / DomainError) --> W[Pass-through Actionable Message & Code]
    C -- No (Prisma, Discord, Network, DB) --> M[Mask with Generic Actionable Message & Code]
    W --> L[Emit Server-Side Structured Logger with Correlation ID]
    M --> L
    L --> R[Return Safe ClientError to Caller]
```

### 2.1 Pure Domain Isolation (Law L7)

The core error classifier and domain error representations reside in `apps/web/core/errors/domain/client-error.ts` with **zero external framework, React, Next.js, or ORM dependencies**.

- **`ClientError`**: Immutable interface returned to callers containing `code`, `message`, `correlationId`, and `isDomainError`.
- **`DomainError`**: Base class for domain-originated errors (`isDomainError = true`).
- **`WHITELISTED_DOMAIN_ERROR_NAMES`**: Curated set of trusted domain error classes designed to produce human-actionable, user-safe messages:
   - Authorization & Access: `AuthError`, `AdminAccessError`, `DevAccessError`, `ParticipantAccessError`
   - Challenge & Lifecycle: `ChallengeStateError`, `DuoTeamIdentityError`, `WithdrawalError`
   - Economy & Wagers: `WagerValidationError`, `BettingClosedError`, `InsufficientFundsError`, `InvalidReservationError`, `WalletInvariantViolationError`, `InvalidAmountError`
   - Study Time & Tracking: `InvalidDurationError`, `InvalidProgressError`, `DeficitCalculationError`, `DurationParseError`, `DurationRangeError`, `MaximumLeavesExceededError`
   - Pokemon Acquisition: `BannerNotFoundError`, `BannerInactiveError`, `InvalidBannerConfigError`, `EmptyRarityPoolError`, `SelectionEngineError`
   - Yeolpumta: `InvalidYptClaimTransitionError`

### 2.2 Server-Side Correlation Logging

`toClientError(error, options)` in `apps/web/core/errors/to-client-error.ts`:

1. Generates a unique UUID `correlationId` (using `crypto.randomUUID()` with fallback).
2. Resolves whether the error is a trusted domain exception or untrusted infrastructure failure.
3. Automatically logs the full raw error server-side via `createLogger` with structured context (`correlationId`, `code`, `isDomainError`, and custom parameters).
4. Returns the sanitized `ClientError` to the server action or route handler.

### 2.3 Tasker Bot Error Masking

In `apps/tasker/src/lib/error-sanitizer.ts`:

- Untrusted Discord API failures, Gemini API exceptions, and database errors in slash commands (e.g. `/yapperize`) are masked with user-friendly messages.
- Specific known error names (e.g. `DefaultCategoryDeletionError`, `DuplicateCategoryError`) pass their human-friendly explanations through.
- Correlation IDs are logged to stderr for administrator tracing without leaking credentials or upstream tokens into Discord channels.

---

## 3. Usage Examples

### Server Actions

```typescript
import { toClientError } from "@/core/errors";

export async function exampleAction(input: Input): Promise<ActionResult> {
   try {
      const user = await requireSessionUser();
      await repositoryFunction(input);
      return { ok: true };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "example.action",
         defaultCode: "ACTION_FAILED",
         defaultMessage: "Failed to perform action. Please try again.",
         context: { userId: input?.userId },
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}
```

### Route Handlers

```typescript
import { toClientError } from "@/core/errors";

export async function POST(req: NextRequest) {
   try {
      // ...
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "api.route",
         defaultCode: "INTERNAL_SERVER_ERROR",
         defaultMessage: "An unexpected error occurred.",
      });

      return NextResponse.json(
         {
            success: false,
            error: clientError.message,
            code: clientError.code,
            correlationId: clientError.correlationId,
         },
         { status: 500 }
      );
   }
}
```

---

## 4. Verification & Testing

Unit tests for `toClientError` and `sanitizeTaskerError` cover:

- `apps/web/core/errors/to-client-error.test.ts` (10/10 green)
- `apps/tasker/test/error-sanitizer.test.ts` (3/3 green)
- Representative server action suites verifying infrastructure exception masking across:
   - `admin-pardon.actions.test.ts`
   - `challenge-admin.actions.test.ts`
   - `withdraw-participant.actions.test.ts`
   - `sick-mode.actions.test.ts`
   - `feature-flags.actions.test.ts`
   - `admin-override.actions.test.ts`
   - `wallet.actions.test.ts`
   - `wager.actions.test.ts`
   - `user-directory.actions.test.ts`
   - `ypt-connection.actions.test.ts`
   - `feedback/route.test.ts`
   - `yapperize.test.ts`
