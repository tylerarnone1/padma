# Security model

## Protected assets

- OAuth identities, database sessions, and TOTP secrets
- Application roles and permissions
- Product data introduced by downstream features
- Integration credentials and webhook signing secrets
- Audit history, outbox state, and delivery records

## Trust boundaries

Browser requests, route parameters, headers, OAuth/provider payloads, webhook
destinations, database JSON, and worker retries are untrusted. Validation and
authorization occur where each value crosses into trusted server code.

## Primary threats and controls

| Threat | Controls |
| --- | --- |
| Authentication bypass | Central server session seam; mock mode requires development plus loopback; startup refuses mock mode on a public origin |
| Privilege escalation | Application RBAC, stable permissions, default denial, server enforcement |
| Second-factor takeover | Factor lifecycle requires recent verification or a recent sign-in; enrollment, disclosure, and removal are audited |
| Second-factor brute force | Consecutive-failure cap and temporary lockout on step-up verification |
| Insecure direct object access | Feature-owned access policies, scoped queries, non-disclosing failures, tests |
| CSRF | Protected cookies, configured trusted origins, same-origin checks on mutations |
| Injection or mass assignment | Strict Zod schemas, unknown-field rejection, Prisma parameters |
| Session theft | HttpOnly/Secure/SameSite cookies, server revocation, recent MFA |
| Secret disclosure | Encryption at rest, log redaction, one-time webhook secret display |
| SSRF | URL policy, private-address rejection inside the connection's own resolver, no redirect following, timeouts |
| Event over-delivery | Webhook endpoints are owned; delivery is scoped to the event's declared audience |
| Dual writes | Transactional outbox, emitted only through a transaction client |
| Duplicate delivery | Deterministic idempotency keys and a unique delivery constraint |
| Retry storms | Bounded exponential retry, terminal failure state, request rate limiting |

Recent MFA is an enforced step-up boundary. A user without an enrolled factor
does not satisfy it, and a failed verification never advances the session's
verification timestamp.

Changing a second factor is itself a protected operation, not a side effect of
holding a session. See
[adr/0004-step-up-authentication-boundary.md](./adr/0004-step-up-authentication-boundary.md).

Mock authentication is bound to loopback at the process, configured-origin,
request-host, and cookie-validation layers. It must not be exposed through a
development tunnel or shared container port.

## Product ownership is explicit

Padma does not ship a universal data-ownership model. Every feature must document
and test who may read or mutate each record. Application permissions and record
ownership are separate checks; satisfying one never implies the other.

If a downstream product adds tenancy, it must add the corresponding schema,
compound constraints, query policy, and isolation tests deliberately.

## Known limits of the shipped controls

These are deliberate boundaries, not oversights. A product built on Padma still
owns them.

- Webhook delivery validates the resolved address inside the connection's own
  resolver, which removes the second lookup that a validate-then-fetch sequence
  leaves exploitable. A network-level egress policy is still the control that
  covers a compromised or malicious internal name server.
- Request rate limiting is a fixed window with a read-then-write update, so
  concurrent callers can exceed a limit slightly at a window boundary. It is a
  throttle, not a quota.
- Unauthenticated rate limiting keys on `x-forwarded-for`, which is spoofable
  unless a trusted edge rewrites it. Treat it as abuse mitigation only.
- Exhausted outbox events and webhook deliveries are logged at error level.
  Alerting on those logs is a deployment responsibility.
- Padma's RBAC is application-scoped. Roles and permissions are global; there is
  no organization or workspace boundary until a product adds one.

## Residual production responsibilities

- Use a managed secret store and encryption-key rotation.
- Restrict infrastructure egress to reduce DNS-rebinding risk.
- Monitor audit denials, authentication anomalies, and exhausted deliveries.
- Define backup, restore, retention, and privacy-erasure procedures.
- Review provider scopes and production bootstrap of administrator access.

Use [production-checklist.md](./production-checklist.md) before deployment.
