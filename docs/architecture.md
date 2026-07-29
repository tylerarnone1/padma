# Architecture

Padma separates product decisions from cross-cutting application foundations.
It is intentionally domain-empty.

## Request flow

```text
Next.js route or page
  ├─ session and optional recent-MFA check
  ├─ strict boundary schema
  ├─ application permission
  ├─ feature ownership policy
  └─ service transaction
       ├─ domain state
       ├─ audit event
       └─ outbox event
```

`src/app` composes transport concerns. Product vocabulary belongs in vertical
`src/features/<feature>` slices. Cross-cutting code belongs in `src/lib` only
when it has a stable contract shared by multiple features.

## Identity and access

Better Auth owns passwordless OAuth, sessions, and TOTP. Padma owns an
application-scoped RBAC graph:

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
```

Authorization requires a server-validated session and an explicit permission.
Roles are collections; code never infers capabilities from role names.

RBAC does not determine who owns product data. Every new feature declares its
record ownership and visibility policy. A user-owned app may key records by
`userId`; a public catalog may use publication state; a multi-tenant product may
introduce organizations and memberships. None is universally correct, so none
is embedded in Padma.

## Reliable integrations

Domain changes and provider-neutral `OutboxEvent` records commit atomically.
Workers claim events and dispatch through adapters. Webhook deliveries have
independent retry and idempotency state. This yields at-least-once delivery;
consumers must be idempotent.

## Persistence

PostgreSQL constraints are part of the security model. Prisma models identity,
application RBAC, audit records, outbox state, webhooks, integration
connections, and idempotency keys. Product tables are added by features.

## Presentation

Themes are generated from five ordered palette primitives. Components consume
semantic tokens. Contrast Guard resolves readable foregrounds per context, and
cards apply one universal muted surface transformation without palette-specific
branches.
