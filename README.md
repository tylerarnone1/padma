# Padma v0.1

[![CI](https://github.com/tylerarnone1/padma/actions/workflows/ci.yml/badge.svg)](https://github.com/tylerarnone1/padma/actions/workflows/ci.yml)
[![Security](https://github.com/tylerarnone1/padma/actions/workflows/security.yml/badge.svg)](https://github.com/tylerarnone1/padma/actions/workflows/security.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-0f766e.svg)](./LICENSE)

Padma is a secure-by-default Next.js foundation for people building with coding
agents. It gives the agent established lanes for identity, authorization,
ownership, validation, auditing, and reliable side effects before your first
product prompt.

Most starters optimize the first screen. Padma is designed for the fiftieth AI
iteration—when an agent would otherwise invent a second data-access pattern,
trust authentication as authorization, or bolt a webhook call directly into a
domain transaction.

The core contract is deliberately simple:

- authentication grants no capability by itself;
- every feature declares who owns its records;
- every trust boundary parses strict, bounded input;
- sensitive actions require recent MFA and durable audit;
- domain state and integration events commit together;
- denial and cross-owner behavior are tested, not implied.

Run `npm run generate:feature -- your-feature` and Padma creates a working
default-deny slice. One test fails until ownership is declared in code. That
failure is intentional: the framework cannot safely guess whether your product
is personal, public, application-wide, or tenant-scoped.

Padma ships with no organization, workspace, project, billing, or other borrowed
SaaS domain. Your first feature defines your product.

Padma reduces common implementation risk; it does not make an application
automatically secure. The product built on top still needs explicit ownership
rules, tested authorization decisions, production infrastructure controls, and
an ongoing patching process. Start with the
[architecture](./docs/architecture.md), [threat model](./docs/security.md), and
[ownership patterns](./docs/ownership-patterns.md).

## What is included

| Foundation | Implementation |
| --- | --- |
| Database | PostgreSQL 17, Prisma, schema-as-source-of-truth, idempotent seed |
| Authentication | Passwordless GitHub and Google OAuth through Better Auth |
| Local access | Guarded mock session so evaluation requires no OAuth setup |
| MFA | TOTP enrollment, recent-verification checks, a guarded factor lifecycle, and step-up lockout |
| Authorization | Application-scoped `User → Role → Permission` RBAC |
| Input security | Strict Zod schemas, body-size bounds, media-type and same-origin checks, route rate limits |
| Sessions | Server-side validation, revocation, protected cookies, trusted-origin controls |
| Integrations | Owner-scoped transactional outbox, provider ports, signed webhooks, SSRF checks, retries |
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
npm run setup
npm run doctor
npm run dev:next
```

`npm run setup` checks Node.js, Docker, Compose, and the Docker daemon; selects
coordinated loopback ports; creates the gitignored `.env` with persistent local
secrets; prepares PostgreSQL; verifies the schema; and seeds the development
identity and administrator role. It is safe to rerun: configured ports and
nonblank secrets are preserved. The command never resets a database or applies
schema drift.

After setup, `npm run dev:next` starts Next.js on the port recorded in
`APP_URL`, bound to `127.0.0.1`. PostgreSQL is also published on loopback only.
Mock authentication is intentionally unavailable from LAN addresses,
containers, or public development tunnels.

Open the URL printed by setup (`http://localhost:3000` when the default port is
available). The default `AUTH_MODE="mock"` adds a development-only
mock-account button to `/sign-in`.
Choosing it creates an HTTP-only local session for the credential-free fixture
in `src/mock-data/development-account.ts`. Mock mode only works with a
development build, loopback `APP_URL`, and a loopback request. Setup persists
the signing secret so ordinary restarts retain valid mock cookies. Both
`localhost` and `127.0.0.1` are supported loopback origins.

Use `npm run dev` for later all-in-one starts: it prepares PostgreSQL through
the same fail-closed path and launches Next.js. Use `npm run dev:next` only when
PostgreSQL is already prepared. Starting `next dev` directly is intentionally
unsupported because it can diverge from `APP_URL` and separately compiled
server modules must not invent different cookie-signing secrets.

If mock sign-in returns to `/sign-in`, stop every existing Next.js development
process and restart with `npm run dev`. A server started before its signing
secret was injected cannot be repaired by hot reload.

Open `/components` on the configured `APP_URL` to preview and refine every
stock UI primitive in a standardized, feature-neutral workshop. It is a
development tool and returns 404 in a production build.

Stop the database with:

```bash
npm run db:stop
```

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Create stable local configuration and prepare PostgreSQL safely |
| `npm run doctor` | Diagnose local configuration, Docker, database drift, and app reachability without changing them |
| `npm run dev` | Prepare PostgreSQL, verify the schema, seed, and start local Next.js |
| `npm run dev:next` | Start only Next.js against an already prepared database |
| `npm run generate:feature -- name` | Scaffold a product feature boundary |
| `npm run outbox:drain` | Process currently available outbox and webhook work |
| `npm run db:push` | Apply schema changes to the existing local database |
| `npm run db:reset` | Discard the local database volume and rebuild from the schema |
| `npm run db:migrate -- --name change-name` | Take ownership of the schema with your own migration |
| `npm run db:deploy` | Apply your committed migrations without resetting data |
| `npm run db:studio` | Inspect the local database with Prisma Studio |
| `npm run check` | Run typecheck, lint, tests, and coverage thresholds |
| `npm run build` | Produce the fail-closed production build |

## Build your first feature

```bash
npm run generate:feature -- your-feature
```

The generator does not leave you an empty directory. It writes a working,
default-deny vertical slice: an ownership declaration, a policy that keeps
permission and ownership as separate checks, an owner-scoped repository, a
service that refuses before it queries, and authorization tests that include the
non-disclosure cases most implementations miss.

Generation is atomic: invalid names, the wrong working directory, an existing
feature, or a write failure produce an actionable error without leaving a
partial feature directory.

One generated test fails on purpose:

```text
Declare who owns a your-feature record in src/features/your-feature/ownership.ts
```

Padma cannot answer that for you, and an unanswered ownership question is the
most common route to a broken authorization boundary. The failure clears as soon
as the decision is recorded in code rather than in a comment.

Then work through the rest of the generated README:

- How may a caller address a record?
- Which explicit permission protects each operation?
- Which inputs cross a trust boundary?
- What must be audited?
- Which side effects need an outbox event, and who is its audience?

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

Endpoints belong to the user who registered them, and an event is delivered only
to endpoints owned by the party the event is about:

```text
POST   /api/webhooks               register an endpoint (signing secret returned once)
GET    /api/webhooks               list your own endpoints
DELETE /api/webhooks/{endpointId}  revoke one of your own endpoints
```

Features emit events through `enqueueIntegrationEvent`, which accepts only a
transaction client so domain state and its event commit together. Every event
declares an `ownerId`. `null` means the event has no audience and reaches no
endpoint; it never means everyone. See
[docs/adr/0005-integration-event-audience.md](./docs/adr/0005-integration-event-audience.md).

## Real OAuth mode

`AUTH_MODE="mock"` is only valid with a loopback `APP_URL`. Any other origin
fails environment validation at startup rather than silently falling back, so a
deployment cannot inherit mock authentication by forgetting to set it.

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

## Database schema policy

Padma ships a schema, not a migration history. `prisma/migrations/` is
gitignored, and `prisma/schema.prisma` is the single source of truth.

`npm run dev` creates the schema when the database is **empty**, and otherwise
never touches it. On every later start it compares the database against
`prisma/schema.prisma`:

- identical: it proceeds silently;
- different: it prints the difference, refuses to start, and tells you to run
  `npm run db:push` or `npm run db:reset`.

Startup does not reconcile an existing database, deliberately. A schema edit —
including one an agent made on your behalf — would otherwise rewrite your local
data the next time you booted the app, and a dropped column is indistinguishable
from a feature that just worked. Applying a schema change is always an explicit
command you run yourself.

```bash
npm run db:reset   # discard the local volume and rebuild from the schema
```

**Your first migration is your own.** As soon as you have data worth keeping —
which is well before your first deployment — take ownership of the schema:

we ```bash
npm run db:migrate -- --name init   # creates your baseline from the schema
```

From then on `prisma migrate deploy` is your deployment workflow and each schema
change is a new forward-only migration. Commit them; they are your history. Do
not edit one after it has been applied.

`prisma db push` is a local bootstrap only. It is not a deployment tool: it can
drop a column to make the database match the schema, and it records nothing about
how it got there. Never replace a database constraint with an application-only
check either — unique keys and foreign keys are part of the security model.

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
schema, synchronize the database with it, audit production dependencies, and build
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
