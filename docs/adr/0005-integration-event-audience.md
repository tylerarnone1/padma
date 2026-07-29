# ADR 0005: Integration event audience

Status: accepted

## Context

`WebhookEndpoint` had no owner column, and `WebhookAdapter.dispatch` selected
every active endpoint and delivered each matching outbox event to all of them.
Any caller who could register a webhook received every event in the application,
including payloads about other users' records. This contradicted Padma's own
ownership invariant in the one place the repository demonstrated it, and there
was no list or revoke operation, so ownership enforcement was never shown at all.

Separately, nothing in the repository ever wrote an `OutboxEvent`. The invariant
requiring domain state and its event to commit together had no supporting API,
so the first feature to need one would have invented its own.

The complication is that Padma deliberately ships no tenancy model, so it cannot
know who owns a given event.

## Decision

Make the audience an explicit property of each event rather than an implicit
consequence of who happens to have registered an endpoint.

- `WebhookEndpoint.ownerId` is required and is a foreign key to `User`.
  Ownership is taken from the verified session, never from a request body.
- `OutboxEvent.ownerId` is nullable but has no default in the emit API, so an
  emitter must state it. `null` means the event has no user-facing audience and
  is delivered to nothing. It is never a wildcard.
- `dispatch` selects endpoints by `ownerId` matching the event's owner.
- `enqueueIntegrationEvent` accepts only a transaction client, so an event
  cannot be recorded outside the transaction that produced the state it
  describes. Duplicate idempotency keys are skipped rather than raising, so a
  retried command cannot abort the caller's transaction.
- Reads and revocations are addressed by owner and id together. A caller who
  names another owner's endpoint gets the same response as one who invents an
  id.

`IntegrationConnection` gained an owner for the same reason, so the schema does
not model ownerless encrypted credentials.

## Consequences

If a product later attributes events to something other than a user — an
organization, say — the owner values on endpoints and events must agree. A
mismatch delivers nothing rather than delivering to the wrong party, which is
the failure direction we want, but it will look like silence and is called out
in the ownership documentation.

Ownership is enforced by a `NOT NULL` column and a foreign key rather than by
application code alone, so an ownerless endpoint cannot be created even by a
future code path that forgets to set one.

Because Padma is unreleased, this arrived by regenerating the baseline migration
rather than as a forward migration. Any database created before it must be
recreated. There is no upgrade path for existing rows and there should not be:
an ownerless endpoint has no correct owner to assign, and it is the exposure
being closed.
