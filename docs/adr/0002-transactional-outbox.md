# ADR 0002: Transactional outbox for integrations

Status: accepted

## Context

Calling third parties during a database mutation creates dual-write failures: product state can commit while the integration fails, or the integration can succeed while product state rolls back.

## Decision

Write provider-neutral outbox events in the same PostgreSQL transaction as domain state. A separate worker claims and dispatches events through adapters. Webhook delivery has its own idempotent records and retry state.

## Consequences

Product requests do not wait on third parties. Delivery is at-least-once, so consumers require idempotency. Operations must schedule and monitor the worker.
