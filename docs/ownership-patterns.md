# Ownership patterns

Application permissions answer whether a principal may attempt an operation.
An ownership policy answers which records that principal may address. A feature
needs both, and the ownership condition belongs in the database query whenever
possible.

These are shapes, not a tenancy model to copy blindly.

## User-owned record

Derive `ownerId` from the validated session. Never accept it in the request.
Query with both identifiers so another owner's record is indistinguishable from
a missing record:

```ts
const record = await transaction.record.findFirst({
  where: {
    id: input.recordId,
    ownerId: session.user.id,
  },
});
```

The isolation test creates two users and two records, then proves that each
user can address only their own record even when they know the other's ID.

## Published public record

Public reads scope by publication state. Management reads separately require an
explicit permission and the feature's editorial ownership rule:

```ts
const record = await database.record.findFirst({
  where: {
    id: input.recordId,
    publishedAt: { lte: new Date() },
  },
});
```

Never fetch an unpublished record globally and decide afterward whether to
hide it.

## Application-global configuration

Some records, such as system webhook endpoints, are owned by the application
rather than a person. Document that decision and require the corresponding
management permission. Do not add a meaningless `userId` merely to satisfy a
template.

## Tenant-owned record

Only introduce organizations or workspaces when the product requires them.
Membership, tenant ownership, and record identity should be enforced with
foreign keys and compound constraints. Queries include the trusted active
tenant ID and record ID together; tests prove isolation across at least two
tenants and users with different memberships.

## Minimum policy tests

- unauthenticated access is denied;
- authentication without the permission is denied;
- permission without record ownership is denied;
- another owner cannot reveal whether a guessed record exists;
- ownership identifiers cannot be supplied or changed by the client;
- create, update, delete, and list paths use the same boundary;
- role, membership, and ownership changes are audited;
- duplicate requests cannot duplicate state or side effects.
