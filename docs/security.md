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
| Authentication bypass | Central server session seam; mock mode requires development plus loopback |
| Privilege escalation | Application RBAC, stable permissions, default denial, server enforcement |
| Insecure direct object access | Feature-owned access policies, scoped queries, non-disclosing failures, tests |
| CSRF | Protected cookies, trusted origins, same-origin checks on mutations |
| Injection or mass assignment | Strict Zod schemas, unknown-field rejection, Prisma parameters |
| Session theft | HttpOnly/Secure/SameSite cookies, server revocation, recent MFA |
| Secret disclosure | Encryption at rest, log redaction, one-time webhook secret display |
| SSRF | URL policy, DNS resolution checks before delivery, redirect refusal, timeouts |
| Dual writes | Transactional outbox |
| Duplicate delivery | Idempotency keys and unique delivery records |
| Retry storms | Bounded exponential retry and terminal failure state |

Recent MFA is an enforced step-up boundary. A user without an enrolled factor
does not satisfy it, and a failed verification never advances the session's
verification timestamp.

Mock authentication is bound to loopback at the process, configured-origin,
request-host, and cookie-validation layers. It must not be exposed through a
development tunnel or shared container port.

## Product ownership is explicit

Padma does not ship a universal data-ownership model. Every feature must document
and test who may read or mutate each record. Application permissions and record
ownership are separate checks; satisfying one never implies the other.

If a downstream product adds tenancy, it must add the corresponding schema,
compound constraints, query policy, and isolation tests deliberately.

## Residual production responsibilities

- Use a managed secret store and encryption-key rotation.
- Restrict infrastructure egress to reduce DNS-rebinding risk.
- Monitor audit denials, authentication anomalies, and exhausted deliveries.
- Define backup, restore, retention, and privacy-erasure procedures.
- Review provider scopes and production bootstrap of administrator access.

Use [production-checklist.md](./production-checklist.md) before deployment.
