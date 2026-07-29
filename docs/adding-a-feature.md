# Adding a feature

Create a vertical slice:

```bash
npm run generate:feature -- feature-name
```

Before writing implementation, answer in the generated README:

1. Who owns every record?
2. How can a caller address or discover it?
3. Which stable `resource:action` permission protects each operation?
4. Which fields are caller-controlled?
5. Which actions require recent MFA or an audit event?
6. Which side effects require an outbox event?

Keep UI in `components`, Prisma access in `data` or `services`, pure decisions in
`policies`, strict boundary parsing in `schemas`, and regression tests in
`tests`.

For protected mutations, preserve this order: same-origin check, session, recent
MFA if sensitive, bounded schema parsing, explicit permission, ownership policy,
transactional state/audit/outbox writes, safe response.

At minimum, tests should prove:

- unauthenticated callers are rejected;
- authenticated callers without the permission are rejected;
- callers cannot address records outside the feature's ownership boundary;
- unknown or oversized input is rejected;
- duplicate delivery or retry cannot duplicate state;
- sensitive values do not appear in responses or logs.

Do not introduce organizations, workspaces, or another ownership hierarchy
unless the product feature genuinely requires it.
