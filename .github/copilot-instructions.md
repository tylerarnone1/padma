# Padma repository instructions

`AGENTS.md` is the canonical repository contract. Read it completely before
planning, editing, reviewing, or generating code, and preserve its required
operation order and security invariants.

For every product feature, identify record ownership, explicit permissions,
trust-boundary schemas, recent-MFA requirements, audit outcomes, outbox events,
and the tests proving default denial. Authentication never implies
authorization.

Do not weaken a rule in `AGENTS.md` for convenience. If a requested change
conflicts with that contract, explain the conflict before proceeding.
