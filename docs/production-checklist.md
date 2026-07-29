# Production checklist

Padma fails closed on missing production secrets, but secure production
operation still depends on deployment choices. Record the owner and evidence
for every item before launch.

## Identity and secrets

- Set `AUTH_MODE="oauth"` and configure only the providers the product uses.
- Generate unique high-entropy `BETTER_AUTH_SECRET` and
  `INTEGRATION_ENCRYPTION_KEY` values in a managed secret store.
- Define and audit the first production Administrator bootstrap. Never assign
  the development fixture.
- Verify provider callback URLs, account-linking behavior, scopes, and session
  revocation.
- Establish rotation procedures for authentication, integration, webhook, and
  provider credentials.

## Network and runtime

- Terminate TLS at a trusted boundary and redirect HTTP to HTTPS.
- Preserve the CSP and security headers, including production HSTS.
- Configure trusted origins narrowly. Do not use wildcard preview domains.
- Restrict application and worker egress. DNS checks reduce SSRF risk but
  infrastructure egress policy closes DNS-rebinding and routing races.
- Run PostgreSQL with a dedicated least-privilege application role, encrypted
  transport, network restrictions, and managed credentials.
- Keep development servers and mock authentication off shared or public
  networks.

## Request handling

- Terminate `x-forwarded-for` at a trusted edge and overwrite any client-supplied
  value. Unauthenticated rate limiting keys on it and is otherwise spoofable.
- Set `TRUSTED_ORIGINS` for every additional origin that serves the application.
  Same-origin checks accept only `APP_URL`, that list, and the request's own
  origin; the `Host` header is deliberately not trusted.
- Confirm `AUTH_MODE="oauth"` and a non-loopback `APP_URL`. Startup rejects the
  mock combination, so a failed boot here is the control working.
- Review the per-route rate limits against expected traffic. They are fixed
  windows and permit slight overshoot at a boundary.

## Data and operations

- Own your schema history before your first deployment: run
  `npm run db:migrate -- --name init`, commit the result, and apply migrations
  with `prisma migrate deploy`. Never deploy with `prisma db push`; it is a
  local bootstrap and can drop columns to force the database to match.
- Schedule both outbox and webhook-delivery processing continuously.
- Alert on stale processing leases, exhausted outbox events and deliveries
  (logged at error level), audit failures, authentication anomalies, and
  repeated authorization denials.
- Alert on `mfa:enable`, `mfa:disable`, and `mfa:get-totp-uri` audit events.
  A factor change the user did not initiate is an account-takeover signal.
- Define backup, point-in-time recovery, restore testing, retention, privacy
  erasure, and incident-response procedures.
- Treat audit data as sensitive. Restrict mutation and retention access.

## Release controls

- Require the CI and security workflows on protected branches.
- Enable GitHub private vulnerability reporting, secret scanning, push
  protection, Dependabot alerts, dependency review, and CodeQL where available.
- Review dependency, schema, permission, ownership, logging, and egress changes
  explicitly.
- Run `npm run check`, `npm run build`, `npm run db:generate`, and
  `npx prisma validate` with production-shaped configuration.
