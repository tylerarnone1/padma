# Padma v0.1

Padma is a secure-by-default Next.js starter built to stay legible while humans
and coding agents extend it. It provides the difficult cross-cutting
foundations without deciding what product you are building.

It ships with no organization, workspace, project, billing, or other borrowed
SaaS domain. Your first feature defines your product.

Padma reduces common implementation risk; it does not make an application
automatically secure. The product built on top still needs explicit ownership
rules, tested authorization decisions, production infrastructure controls, and
an ongoing patching process.

## What is included

| Foundation | Implementation |
| --- | --- |
| Database | PostgreSQL 17, Prisma, one current baseline migration, idempotent seed |
| Authentication | Passwordless GitHub and Google OAuth through Better Auth |
| Local access | Guarded mock session so evaluation requires no OAuth setup |
| MFA | TOTP enrollment and recent-verification checks for sensitive actions |
| Authorization | Application-scoped `User → Role → Permission` RBAC |
| Input security | Strict Zod schemas, body-size bounds, media-type and same-origin checks |
| Sessions | Server-side validation, revocation, protected cookies, trusted-origin controls |
| Integrations | Transactional outbox, provider ports, signed webhooks, SSRF checks, retries |
| Observability | Structured redacted logging, request correlation, durable audit events |
| UI | Atomic components, error boundaries, 401/403/404 pages |
| Themes | Five source primitives, generated light/dark modes, palette preview, Contrast Guard |
| AI guidance | Repository contract, feature generator, ADRs, security checklist, tests |

## Quick start

Requirements:

- Node.js 22.12 or newer
- Docker with Compose

```bash
npm install
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
npm run dev
```

`npm run dev` starts PostgreSQL on port `5433`, waits for it to become healthy,
applies the committed baseline migration, seeds the development identity and
administrator role, then starts Next.js bound to `127.0.0.1`. PostgreSQL is
also published on loopback only. Mock authentication is intentionally
unavailable from LAN addresses, containers, or public development tunnels.

Open [http://localhost:3000](http://localhost:3000). The default
`AUTH_MODE="mock"` adds a development-only mock-account button to `/sign-in`.
Choosing it creates an HTTP-only local session for the credential-free fixture
in `src/mock-data/development-account.ts`. Mock mode only works with a
development build, loopback `APP_URL`, and a loopback request. Its signing
secret is random when `BETTER_AUTH_SECRET` is not configured, so restarting the
development server invalidates existing mock cookies. Both `localhost` and
`127.0.0.1` are supported loopback origins.

Use `npm run dev:next` only when PostgreSQL is already prepared. It skips
Compose, migrations, and seeding, but still binds Next.js to loopback and
injects one process-wide random signing secret. Starting `next dev` directly
is intentionally unsupported because separately compiled server modules must
not invent different cookie-signing secrets.

If mock sign-in returns to `/sign-in`, stop every existing Next.js development
process and restart with `npm run dev`. A server started before its signing
secret was injected cannot be repaired by hot reload.

Open [http://localhost:3000/components](http://localhost:3000/components) to
preview and refine every stock UI primitive in a standardized, feature-neutral
workshop.

Stop the database with:

```bash
npm run db:stop
```

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Prepare PostgreSQL, migrate, seed, and start local Next.js |
| `npm run dev:next` | Start only Next.js against an already prepared database |
| `npm run generate:feature -- name` | Scaffold a product feature boundary |
| `npm run outbox:drain` | Process currently available outbox and webhook work |
| `npm run db:migrate -- --name change-name` | Create a reviewed development migration |
| `npm run db:deploy` | Apply committed migrations without resetting data |
| `npm run db:studio` | Inspect the local database with Prisma Studio |
| `npm run check` | Run typecheck, lint, tests, and coverage thresholds |
| `npm run build` | Produce the fail-closed production build |

## Build your first feature

```bash
npm run generate:feature -- your-feature
```

Before implementation, complete the generated feature README:

- Who owns each record?
- How may a caller address it?
- Which explicit permission protects each operation?
- Which inputs cross a trust boundary?
- What must be audited?
- Which side effects need an outbox event?

Padma does not answer those product questions with a hard-coded tenancy model.
An app for one person, a public community, an internal tool, and a multi-tenant
SaaS product need different ownership rules.

See [docs/ownership-patterns.md](./docs/ownership-patterns.md) for concrete,
domain-neutral query and isolation-test shapes without adopting a universal
tenancy model.

## Authorization model

Authentication establishes identity. It grants no product capability.

Roles and permissions are global to this application:

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
```

Canonical framework permissions use stable `resource:action` keys. The seed
creates an `Administrator` role and gives it to the local mock user so the
starter can be explored immediately. A real product should define how its first
production administrator is bootstrapped.

Feature data authorization is separate from RBAC. Each feature must enforce its
own ownership or visibility policy in addition to checking a permission.

## Protected mutation pattern

```text
request
  → request ID and structured context
  → same-origin check
  → real server session
  → recent MFA when sensitive
  → strict, bounded input parsing
  → explicit permission + feature ownership policy
  → database transaction
       ├─ domain write
       ├─ audit event
       └─ provider-neutral outbox event
  → typed response or safe problem response
```

The browser is never the enforcement point. Server code rechecks the session,
permission, ownership, and input at the operation boundary.

## Integrations

Features emit provider-neutral outbox events in the same transaction as domain
state. Workers dispatch them through `IntegrationAdapter` ports. The included
webhook adapter signs payloads, checks destinations against SSRF, records each
delivery, applies bounded retries, and supports idempotent processing.

This is the seam for broad automation platforms such as Zapier, Pipedream, or
Nango. Product features remain independent of whichever provider is selected.

Create a webhook through the protected application-level endpoint:

```text
POST /api/webhooks
```

The signing secret is returned once.

## Real OAuth mode

Set:

```dotenv
AUTH_MODE="oauth"
BETTER_AUTH_SECRET="<unique random value>"
INTEGRATION_ENCRYPTION_KEY="<different unique random value>"
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

Configure either or both providers. Keep secrets out of source control and use a
production secret manager outside local development. Provider callback URLs,
trusted origins, and the public `APP_URL` must match the deployed HTTPS origin.

## Repository map

```text
src/
├─ app/                 routes and composition
├─ components/ui/       atomic, domain-neutral UI
├─ features/
│  ├─ access-control/   application RBAC policy and data access
│  ├─ auth/             identity and account security
│  └─ integrations/     outbox and provider ports
├─ lib/                 shared infrastructure
├─ mock-data/           local-only fixture identity
└─ theme/               palettes, generation, and Contrast Guard
prisma/                 schema, migration, and seed
docs/                   architecture, security, and ADRs
scripts/                dev orchestration, generators, workers
```

## Database migration policy

The repository currently ships one baseline migration that exactly matches
`prisma/schema.prisma`. This is intentional for an unreleased starter: a new
installation should create the current database directly, without replaying
the private development history that produced it.

The baseline may be regenerated or consolidated only before the first public
release tag. Once anyone can deploy a published version, committed migrations
are immutable history. Every later schema change must use a new forward-only
migration; do not edit an applied migration or replace database constraints
with application-only checks. `prisma db push` is not the project deployment
workflow.

## Verification

```bash
npm run check
npm run build
```

For schema work:

```bash
npm run db:generate
npx prisma validate
```

`next build` uses a production environment and intentionally fails closed when
`BETTER_AUTH_SECRET` or `INTEGRATION_ENCRYPTION_KEY` is missing. Populate them
with unique random values before building; never use CI placeholders in a
deployment.

Pull requests run the same checks against PostgreSQL, validate the Prisma
schema, apply the committed migration, audit production dependencies, and build
the application. Separate security automation performs dependency review and
CodeQL analysis. GitHub Actions are pinned to immutable commits and maintained
through Dependabot.

Read [AGENTS.md](./AGENTS.md) before extending the starter. It is the executable
contract for both coding agents and human contributors.

Thin discovery files also route GitHub Copilot, Cursor, Claude Code, and Gemini
to that canonical contract. Do not fork security rules across agent-specific
files.

## Security

Read [docs/security.md](./docs/security.md) for the threat model and
[SECURITY.md](./SECURITY.md) for vulnerability reporting. Never commit real
credentials, tokens, production data, or copied provider payloads.

Before deployment, complete
[docs/production-checklist.md](./docs/production-checklist.md). Local defaults
are not a substitute for production TLS, egress restrictions, worker
scheduling, administrator bootstrap, monitoring, backups, or key rotation.

## License

MIT. See [LICENSE](./LICENSE).
