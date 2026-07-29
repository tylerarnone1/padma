# ADR 0004: Step-up authentication boundary

Status: accepted

## Context

Padma is OAuth-only, so no user has a password. Better Auth's two-factor plugin
is therefore configured with `allowPasswordless: true`, which makes its internal
`shouldRequirePassword` check resolve to false for every account: it looks for a
credential account with a password, and one never exists.

That left `/two-factor/enable`, `/two-factor/disable`, `/two-factor/get-totp-uri`
and `/two-factor/generate-backup-codes` reachable with nothing but a valid
session cookie. `enable` deletes any existing enrollment and issues a new
secret, so a stolen session could silently replace or remove the victim's second
factor and then satisfy every `requireRecentMfa` gate.

Two related defects compounded it. Better Auth's `verifyTOTP` endpoint declares
no session middleware and does not rotate the session cookie for an
already-enrolled user, so neither `context.session` nor `context.newSession` was
populated and Padma's hook never refreshed `mfaVerifiedAt` after the first
enrollment. And Better Auth applies its configured `accountLockout` only when
`session.session` is absent, which is the sign-in challenge — never Padma's
step-up path.

The net effect was a control that failed closed for an honest user re-verifying
and open for an attacker re-enrolling.

## Decision

Treat the second factor as a credential whose lifecycle is itself a protected
operation, enforced in Padma rather than delegated.

1. A `before` hook (`src/lib/auth/mfa-guard.ts`) guards every two-factor
   lifecycle endpoint. An enrolled caller must present a recent verification of
   the current factor. A caller with no factor must hold a recently established
   session, because there is nothing yet to prove possession of. Device loss is
   recovered with a backup code, which elevates the session and then satisfies
   the enrolled branch.
2. Recency is stamped from the verified session token in the response body
   rather than from the hook's session snapshots, because that token is the only
   reliable handle on the session that was elevated. A success that carries no
   recognizable token is logged at error level instead of passing silently.
3. Padma maintains its own consecutive-failure cap for step-up verification,
   using the `failedVerificationCount` and `lockedUntil` columns the two-factor
   table already has.
4. Enrollment, replacement, secret disclosure, and removal are audited, as are
   guard denials.

The hook is chosen over Padma-owned route handlers because `/api/auth/*` is
delegated to Better Auth wholesale: a hook is the one seam that no caller can
route around, whereas a parallel handler would leave the original path open.

## Consequences

A user who has not signed in recently must re-authenticate before enrolling a
first factor. For OAuth that is one click, and the UI offers it directly.

Padma now depends on two Better Auth implementation details: the shape of the
verification response and the set of two-factor endpoint paths. Both are
covered by tests that fail loudly rather than degrading quietly, and the
`allowPasswordless` interaction is documented here so an upgrade re-examines it.

Step-up remains unavailable in mock authentication mode, which is unchanged and
still fail-closed: the mock session carries no verification timestamp.
