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

## Data and operations

- Apply committed migrations before serving a new release.
- Schedule both outbox and webhook-delivery processing continuously.
- Alert on stale processing leases, exhausted deliveries, audit failures,
  authentication anomalies, and repeated authorization denials.
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
