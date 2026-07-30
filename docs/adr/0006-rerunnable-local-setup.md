# ADR 0006: Rerunnable local setup

## Status

Accepted.

## Context

Padma's manual quick start required copying an environment template, choosing
coherent application and database ports, understanding which blank secrets
were safe only in development, and then starting the database preparation
path. Those are mechanical decisions, but getting one wrong can break trusted
origins, mock authentication, database connectivity, or session continuity.

Setup also has to be safe after the first run. Silently changing a configured
port can disconnect a project from its existing Compose volume, and rotating a
development authentication or encryption secret can invalidate sessions or
make locally encrypted integration data unreadable.

## Decision

`npm run setup` is the bounded local bootstrap command.

- It runs after dependency installation and preflights the supported Node
  version, Docker, Compose, the Docker daemon, and required repository files.
- It manages only `NODE_ENV="development"`, `AUTH_MODE="mock"`, and a loopback
  HTTP `APP_URL`. Production and OAuth configuration remain explicit adopter
  responsibilities.
- On the first run, it chooses the first available app port from `3000-3099`
  and PostgreSQL port from `5433-5532`, then writes coherent `APP_URL`,
  `POSTGRES_PORT`, and `DATABASE_URL` values.
- It generates independent persistent authentication and integration
  encryption secrets in the gitignored `.env` file and never prints them.
- A rerun preserves nonblank managed values, comments, ordering, and unknown
  keys. It fills blanks but never rotates secrets or silently reassigns ports.
- An occupied configured PostgreSQL port is accepted only when this Compose
  project owns it. An occupied app port is reported without being changed
  because the development server may already be running.
- It invokes the same fail-closed database preparation used by `npm run dev`.
  Empty databases may be created; existing drift is displayed and refused.
  Setup never resets a volume or reconciles an existing schema.
- It prepares services and fixtures but does not own the long-running Next.js
  process. After the read-only diagnostic, `npm run dev:next` owns that process.
- `npm run doctor` provides the read-only verification path for configuration,
  service health, schema drift, and application reachability.

`APP_URL` is the development server port contract. Direct Next.js port
arguments may repeat that value but may not conflict with it.

## Consequences

The first local setup has one configuration command and safe reruns retain
session and encrypted-data continuity. The generated `.env` remains a local
plaintext secret file, so it stays gitignored and is not a production secret
store.

Topology selection and generated product decisions are intentionally separate
work. This ADR creates the setup seam they can extend without changing local
service preparation.
