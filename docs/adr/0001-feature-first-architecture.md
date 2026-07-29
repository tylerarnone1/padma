# ADR 0001: Feature-first architecture

Status: accepted

## Context

Layer-only repositories spread one change across global controller, service, model, and component trees. Coding agents then infer ownership from imports rather than locality, increasing accidental coupling.

## Decision

Organize domain code as vertical feature slices. Keep only transport composition in `src/app`, visual primitives in `src/components/ui`, and genuinely cross-cutting infrastructure in `src/lib`.

## Consequences

Domain vocabulary and tests remain local. Some technical patterns repeat between features; extraction happens only after a stable shared contract is visible.
