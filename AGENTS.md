<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Padma agent contract

Padma is a secure-by-default, AI-legible Next.js foundation. It intentionally
does not prescribe a product domain, tenancy model, or ownership hierarchy.
Optimize for correctness and explicit boundaries before brevity.

## Non-negotiable security invariants

1. Default deny. Authentication never implies authorization.
2. Every feature declares who owns each record and enforces that access before
   revealing or mutating it.
3. Proxy checks are optimistic only. Every page, route handler, server action,
   and service validates the real session and authorization it needs.
4. Treat request bodies, route parameters, headers, provider payloads, and
   database JSON as untrusted input.
5. Validate at the trust boundary with a strict schema. Reject unknown fields.
6. Sensitive operations require `requireRecentMfa`, not merely an account-level
   MFA flag.
7. Never log passwords, cookies, tokens, secrets, raw provider payloads, or
   unnecessary PII.
8. Audit security-sensitive success, denial, and failure outcomes. Operational
   logs are not audit records.
9. Commit domain state and its `OutboxEvent` in the same database transaction.
   Do not call third parties inside domain transactions.
10. Integration consumers are idempotent. Webhooks are signed, bounded,
    retried, and checked against SSRF.
11. Expected errors are typed return values or `ApplicationError`s. Unexpected
    errors go to an error boundary and expose no internals.
12. Database constraints are part of the security model. Do not replace unique
    keys or foreign keys with application-only checks.
13. Mock authentication is a local adapter, never a production fallback. It
    requires `AUTH_MODE="mock"`, `NODE_ENV="development"`, and a loopback
    `APP_URL`; it requires an explicit sign-in action and an integrity-protected
    HTTP-only cookie behind the centralized server session seam.

## Repository shape

- `src/app`: routing and composition; no domain logic.
- `src/components/ui`: reusable visual primitives with no domain knowledge.
- `src/features/<feature>`: vertical product slices.
- `src/lib`: cross-cutting infrastructure only.
- `prisma`: canonical persistence schema, migrations, and seed.
- `docs`: architecture, threat model, and decisions.
- `scripts`: bounded developer and worker entry points.

A feature may contain `components`, `data`, `policies`, `schemas`, `services`,
and `tests`. Create one with:

```bash
npm run generate:feature -- feature-name
```

## Required operation order

For every protected mutation:

1. Establish request correlation.
2. Check same-origin protection for cookie-authenticated mutations.
3. Validate the server-side session.
4. Require recent MFA for credentials, access, billing, secrets, or integrations.
5. Parse a size-bounded body with a strict schema.
6. Authorize the explicit permission and feature ownership policy.
7. Execute ownership-scoped writes.
8. Commit audit and outbox records in the same transaction when applicable.
9. Return a typed response or RFC 9457-style problem response.

Changing this order requires a documented security reason.

## Data and authorization rules

- Do not accept identity, role, ownership, price, or security status from a
  client when it can be derived from trusted state.
- Query protected records through the ownership boundary; do not fetch globally
  and authorize afterward when doing so can reveal existence.
- Permission names are stable `resource:action` contracts.
- Roles collect permissions. Do not spread role-name conditionals through UI.
- UI hiding is convenience. Server enforcement is the control.
- Prisma access belongs in data or service modules, not client components.
- Padma's RBAC is application-scoped. Add organizations or workspaces only when
  the product actually needs them, as an explicit feature and schema decision.

## Integrations

Domain code emits provider-neutral events. Provider adapters implement
`IntegrationAdapter`.

- Do not import Zapier, Nango, Pipedream, or product-specific providers into a
  domain service.
- Encrypt OAuth credentials and webhook secrets at rest.
- Re-resolve and check webhook destinations before each delivery.
- Production infrastructure still needs an egress policy to close DNS-rebinding
  races.
- Never retry indefinitely. Surface exhausted deliveries.

## Dependencies

Keep dependencies minimal. Before adding one, document why platform APIs or an
existing dependency are insufficient. Do not casually reimplement
authentication, cryptography, validation, or database libraries.

## Theme generation

- Author palette values only in `src/theme/palettes.ts`.
- Every palette defines, in order, `primaryDark`, `primaryLight`, `base`,
  `secondaryLight`, and `secondaryDark`, including the complete shade ladder.
- `theme-generator.ts` owns light/dark semantic derivation.
- Preserve the two luminance ramps around `base`.
- Atomic backgrounds declare `data-contrast-context="background"`, `"surface"`,
  `"card"`, or `"raised"`; hover changes declare
  `data-contrast-hover-context`.
- `Card` consumes `cardSurface`. Keep its universal surface mutation in the
  generator; never invent a sixth palette primitive.
- Contrast Guard may select another existing role but must not reduce an entire
  component's opacity.

## Verification

Run before handoff:

```bash
npm run check
npm run build
```

After Prisma changes, also run:

```bash
npm run db:generate
npx prisma validate
```

Test policy decisions, validation boundaries, ownership isolation, and every
security regression. A happy-path UI test is not an authorization test.

## Local development

- `npm run dev` starts Compose PostgreSQL, waits for health, applies committed
  migrations, seeds local fixtures, and launches Next.js.
- PostgreSQL uses host port `5433` by default to avoid an unrelated local
  instance on `5432`.
- `scripts/dev.ts` pins child processes to the container it started.
- Never add a destructive reset to startup. Preserve existing volumes unless
  the user explicitly requests deletion.

## AI change checklist

- What trust boundary changed?
- Who owns every affected record, and how is that ownership enforced?
- Which permission protects the operation?
- Can another route invoke the same action?
- What is logged and audited?
- Is any secret or PII exposed?
- What happens on retry or duplicate delivery?
- Which test proves default denial?
- Did documentation or an ADR become stale?
