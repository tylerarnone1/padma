# ADR 0003: Local development authentication adapter

## Status

Accepted.

## Context

Requiring every evaluator to create a GitHub or Google OAuth application before
seeing the starter creates unnecessary setup friction. A conventional bypass is
unsafe because copied configuration or an exposed development deployment could
turn convenience code into account takeover.

## Decision

Padma provides a server-only development authentication adapter.

- `AUTH_MODE="mock"` requests the adapter.
- `NODE_ENV` must be `development`.
- `APP_URL` must use a loopback hostname.
- The identity is a stable, credential-free fixture in `src/mock-data`.
- Development preflight seeds that user and assigns the system Administrator
  role.
- Evaluators still enter through `/sign-in` and explicitly choose the mock
  account.
- That choice sets a short-lived, integrity-protected, HTTP-only cookie; mock
  mode alone never creates a session.
- `getCurrentSession` and `requireSession` remain the only session seams; pages
  and APIs contain no mock branches.
- Better Auth routes, OAuth, TOTP, and real session cookies are not mocked.

## Consequences

Evaluators can reach the foundation dashboard without third-party setup. The
dashboard clearly labels the mock session and explains that real MFA requires
OAuth mode.

The Administrator assignment is development-only convenience, not a production
bootstrap policy. Production and non-loopback environments cannot activate the
adapter even if `AUTH_MODE` is copied unchanged.
