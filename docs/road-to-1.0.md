# Road to 1.0

Working document. This is a maintainer roadmap, not part of Padma's public
contract — it records decisions and known defects so a new session can resume
without rediscovering them. Delete or rewrite it at the 1.0 tag.

Last updated after the security-audit and integration-ownership work.

## Where things stand

Green as of last session: `npm run check` (26 test files, 168 tests), `npm run build`,
`npx prisma validate`, and a fresh-clone bootstrap (`docker compose down -v` →
`npm run dev:prepare` → `No difference detected`).

Completed:

- MFA subsystem repair — lifecycle guard, step-up recency stamping, attempt
  lockout, lifecycle auditing. See
  [adr/0004-step-up-authentication-boundary.md](./adr/0004-step-up-authentication-boundary.md).
- Integration ownership — owner-scoped webhook endpoints, delivery scoped to an
  event's declared audience, `enqueueIntegrationEvent` emit primitive. See
  [adr/0005-integration-event-audience.md](./adr/0005-integration-event-audience.md).
- SSRF hardening — validating resolver so the checked address is the dialled
  address; NAT64 prefix added.
- Route-handler rate limiting, `withAuditedRequest`, self-audited error flag.
- Feature generator rewritten to emit a working default-deny slice plus one
  deliberately failing ownership-declaration test.
- Schema-as-source-of-truth: `prisma/migrations/` gitignored; startup creates the
  schema only on an empty database and otherwise refuses to reconcile, printing
  the difference instead; `db:push` / `db:reset` are the explicit operations.

Not started: everything below.

---

## 1. Unfixed defects

All four verified by direct inspection. Small, self-contained, and worth doing
first because two of them are actively teaching the wrong pattern.

### 1.1 `danger` button variant fails WCAG AA

`src/components/ui/button.tsx:13` — `danger: "bg-danger text-white hover:opacity-90 shadow-sm"`.

Two problems. `text-white` is the only hardcoded literal colour in the component
layer, and it bypasses Contrast Guard entirely: in dark mode `--danger` is
`#ff7a70`, so white on that is roughly 2.5:1, failing AA on every palette. And
`hover:opacity-90` fades text and background together, which the theme rule in
AGENTS.md explicitly forbids.

Fix: use the guarded pairing rather than a literal. There is no
context for a `danger`-filled background today, so either add a
`danger-foreground` role in the generator (same 5-site change as the `warning`
role in 3.4) or restyle the variant as outlined/tinted using
`text-danger` on a `card`/`raised` context, which the guard already covers.
Replace the opacity hover with a background change plus
`data-contrast-hover-context`.

### 1.2 Placeholder text below the contrast floor

`src/components/ui/input.tsx:10` and `src/components/ui/textarea.tsx:10` —
`placeholder:text-muted/70`.

`--muted` is guaranteed *exactly* 4.5:1 against the canvas (asserted in
`theme.test.tsx`). The `/70` modifier drops it to roughly 2.5–3:1. Placeholder
text is text and must meet AA. Fix: drop the opacity modifier.

### 1.3 `global-error.tsx` renders unstyled

`src/app/global-error.tsx` — confirmed: no `import "./globals.css"`, no
`ThemeHead`. It replaces the root layout, so `bg-background`,
`bg-card-surface`, `text-danger`, `border-border`, and its
`data-contrast-context="card"` have no definitions, and `<html>` carries no
`data-theme`. The last-resort error page is the one most likely to actually
render. Also missing the `suppressHydrationWarning` that `layout.tsx:29` needs.

Fix: import `globals.css` and render `ThemeHead` with a nonce (or accept an
unstyled fallback deliberately and make the markup work without the theme).

### 1.4 `ThemeControls` ships to production on every route

`src/app/layout.tsx:36` mounts it unconditionally. A fixed-position palette
picker overlays product UI in production for every user, and it carries the
repo's largest accessibility cluster:

- `<details>`/`<summary>` popover with no Escape, no outside-click dismiss, no
  focus return, no focus containment; stays open once opened.
- WCAG 2.5.3 Label-in-Name failure: visible text is the *current* mode while
  `aria-label` says *"Switch to {next} mode"*, so voice control can't activate it.
- The mode icon signals the target while the adjacent text signals current state.
- `<div aria-label="Color palettes">` with no `role`, so the group is unlabelled;
  options use `aria-pressed` rather than a `radiogroup`.

Fix: gate the mount on `NODE_ENV !== "production"` (matching what `/components`
now does), or promote it to a real product settings surface built on the
`Dialog`/`RadioGroup` primitives from section 3. Gating is the cheap correct move.

### 1.5 Smaller items

- No skip-to-content link anywhere in `layout.tsx` — WCAG 2.4.1 failure app-wide.
- `src/app/401/page.tsx` and `403/page.tsx` are real indexable routes with no
  `robots: noindex` metadata.
- `Card` and `Alert` spread `{...props}` *after* `data-contrast-context` (and
  Alert's `role`), so a caller can silently override the contrast context or the
  alert role. Spread first, then set the invariants.
- `Alert` derives `role` from `variant`, giving `role="status"` to statically
  rendered neutral/success alerts — they announce nothing on mount while
  permanently occupying the live-region model. `role` should be the caller's
  choice, not a styling side effect.
- `KineticText`: `--word-i` is defined only for `:nth-child(1..10)` and
  `--char-i` for `:nth-child(1..18)`; beyond that, words/chars silently collapse
  to sequence 0 and animate as a block.

---

## 2. Missing platform primitives

Nothing exists for any of these. Each is a credibility gap for a starter that
claims to cover cross-cutting foundations.

- **Session management UI.** README claims session revocation; there is no way to
  list or revoke sessions. Better Auth has the endpoints; the UI and an
  owner-scoped list route do not exist.
- **User and role administration.** No UI, and no documented production
  administrator bootstrap. The seed grants Administrator to the mock user only.
- **Email.** No transport at all. The production checklist now says to alert on
  `mfa:enable` / `mfa:disable`, and notifying the *user* of a factor change is
  the standard account-takeover mitigation — it needs email.
- **File uploads.** No storage abstraction, no upload validation.
- **Pagination.** Becomes near-essential the moment tables land.
- **Health / readiness endpoint.** Nothing for a load balancer to probe.
- **Worker scheduling.** `outbox:drain` is a one-shot batch with no scheduled
  invocation anywhere, and no CI coverage.
- **`IdempotencyKey` is still dead code.** The model exists and nothing uses it.
  Either build the request-idempotency middleware it implies (`Idempotency-Key`
  header on mutations) or drop the table.

---

## 3. Component library

### 3.1 The blocking gap: form field wiring

Highest priority in this section. There is no `Label`, no `Field`, and nothing
anywhere links a validation error to a control.

Worse, `src/app/components/page.tsx:173-179` and `:198-208` nest the help text
*and* the error **inside `<label>`**, so both become part of the control's
accessible name, and the error has no `aria-describedby`/`aria-errormessage` and
no `role="alert"` — it is never announced when validation state changes. That is
the workshop page: the reference example a developer or an agent will copy.

Build `Field` (label + description + error + generated ids + `aria-invalid` /
`aria-describedby` / `aria-errormessage` wiring) as a client component so it can
call `useId`, then fix the workshop page to use it.

### 3.2 Prose styles — blocks the AI chat feature

`globals.css` has no typography for `h1`–`h6`, `ul`, `ol`, `pre`, `blockquote`,
or `table`, and Tailwind preflight strips the defaults. Model markdown will
render as an undifferentiated wall of text. No `@tailwindcss/typography` in
`package.json`.

Structure is expressible with existing semantic roles. **Syntax highlighting
inside code blocks is the one genuine expressiveness gap** — token colours can't
come from five semantic text roles, so that needs a decision (accept a
monochrome code block, or add a small token palette outside the five primitives).

### 3.3 Essential primitives

- `Dialog` / `Modal` — required by the security model itself: MFA step-up and
  destructive-action confirmation both need a focus-trapped overlay. Client
  component; needs `useId`, focus trap, Escape, restore-focus. Backdrop as
  `color-mix(in oklch, var(--foreground) N%, transparent)`, panel on the `card`
  context.
- `Toast` + a polite live region — every mutation currently hand-rolls feedback.
  Also the announcement channel for streaming AI responses.
- `Spinner`, `Skeleton`, and a `loading` state on `Button`. Pending state is
  reimplemented three times today as a text swap with no `aria-busy`.
- `ButtonLink` (or `Button asChild`). The primary-button class string is
  duplicated verbatim in four places: `status-page.tsx:44`, `top-nav.tsx:17`,
  `error.tsx:72`, `account-security.tsx:32`. The contract is already drifting.
- `Table` set — `Table`, `Head`, `Row`, `Cell`, sortable header, `caption`.
  Tailwind preflight resets table borders, so hand-rolled tables render
  borderless. Row hover/selection maps to the `raised` context.
- `AppShell` / `Sidebar`, and a route-agnostic nav. `TopNav`'s
  `current: "dashboard" | "components"` is a closed union with no "none" member —
  **it cannot express a third route, so it blocks adding `/chat`.** No mobile menu.
- `VisuallyHidden` — needed by the live regions above and the skip link.

### 3.4 Chat-specific

`MessageList`, `Message` with role attribution (user vs assistant as `raised` vs
`card`, or `primary`/`primary-foreground` for the user bubble), autosizing
`Textarea` with Enter-to-send and Shift+Enter, a stop-generation button, and
scroll anchoring.

### 3.5 Nice to have

`Switch`, `Radio`/`RadioGroup` (the palette picker wants a radiogroup),
`DropdownMenu`/`Popover`, `Tabs`, `Breadcrumb`, `Pagination`, `Separator`
(hand-rolled twice in `sign-in-form.tsx`), `Code`/`Kbd` (hand-rolled three
times), `CopyButton` (the TOTP URI and one-time backup codes currently have **no**
copy affordance — a real usability defect in the auth flow), `EmptyState`,
`Avatar`, `Tooltip`, `Progress`, `Icon` module, `Card` sub-parts
(`p-6` is hardcoded and every caller overrides it), and a `ui/index.ts` barrel.

### 3.6 Theme work these imply

- **Add a `warning` status role.** `Alert` and `Badge` have only
  neutral/success/danger; auth, billing, and integration UX all need
  "expiring" / "degraded" / "needs attention". Status colours live outside the
  five palette primitives so this is allowed, but it's a 5-site change:
  `statusColors` in `theme.tsx`, `SurfaceContrastInput` and
  `SurfaceContrastTokens` in `contrast-guard.ts`, `guardSurfaceContrast`,
  `semanticVariables`, `contrastContextRule`, and the `@theme inline` block.
- **Complete `theme.colors`.** It exposes `surfaceDanger`/`surfaceSuccess` but
  omits `cardDanger`, `cardSuccess`, `raisedDanger`, `raisedSuccess`,
  `backgroundDanger`, `backgroundSuccess` — all six variables are already
  emitted. Typed consumers can currently reach only 14 of 20 guarded colours.
- **A `disabled` token.** `disabled:opacity-50` on Button is exactly the
  whole-element opacity the theme contract discourages.

### 3.7 Contract a new component must follow

Recorded here so it doesn't need rediscovery. Only four `data-contrast-context`
values are legal: `background`, `surface`, `card`, `raised`. Only five class
names are remapped by the guard: `.text-foreground`, `.text-muted`,
`.text-primary`, `.text-danger`, `.text-success` — `text-primary/80`,
`border-primary`, and `bg-danger` are **not** context-aware, and opacity
modifiers on text defeat the guard. If a component paints its own opaque
background it must declare which token it painted; if hover changes it, declare
`data-contrast-hover-context`. There is no context for a `primary`-filled
background — pair `bg-primary` with `text-primary-foreground`, the only
guaranteed-AA pair. No sixth surface. No inline `style` attributes (production
CSP is `style-src 'self' 'nonce-…'`). Radii and shadows have no Tailwind alias —
write `rounded-[var(--radius-lg)]`.

---

## 4. Setup CLI (`npm run setup`)

Ordered by pain removed. Needs `--yes`/`--non-interactive` from day one, and
`npm run dev` must never become interactive.

1. **Preflight doctor — highest value, writes nothing.** Every bootstrap failure
   currently collapses into one string at `scripts/dev.ts:126-128`. Check Node
   against `engines`, run `docker info`, TCP-probe both chosen ports, detect an
   existing `padma-data` volume.
2. **Port selection, writing `POSTGRES_PORT` + `DATABASE_URL` + `APP_URL`
   together.** This is the wizard's real justification. `dev.ts:62-68`
   recomputes and overwrites `DATABASE_URL`, so `npm run dev` is correct — but
   `db:push`, `db:studio`, `db:seed`, and `outbox:drain` read the stale `.env`
   value via `prisma.config.ts`. Change `POSTGRES_PORT` alone and the dev server
   and Prisma Studio silently point at different databases. Next's port is worse:
   no env var exists (args only), and `APP_URL` stays at 3000 while being Better
   Auth's `baseURL` — so OAuth callbacks break with no diagnostic. Requires
   adding real `PORT`/`APP_PORT` handling to `dev.ts`.
3. **Idempotent `.env` merge.** Merge `.env.example` keys into an existing
   `.env` without clobbering user values or comments. A wizard that overwrites
   `.env` on second run is worse than no wizard.
4. **Persist `BETTER_AUTH_SECRET` once.** Biggest single DX win. `dev.ts:69-71`
   mints a fresh secret per run, so every restart invalidates sessions; two
   README paragraphs exist solely to explain that symptom. **Never regenerate if
   present.**
5. **Generate `INTEGRATION_ENCRYPTION_KEY`** as base64url of exactly 32 bytes
   (stricter than the schema's `min(32)` *chars*, so a 32-char non-base64url
   value passes env validation and fails at first encrypt). `dev.ts` doesn't
   inject it, so local dev silently uses the published fallback key.
   **Never regenerate if present** — rotating it makes existing
   `secretEncrypted` / `credentialsEncrypted` rows undecryptable.
6. Auth mode + OAuth credentials, enforcing the id/secret pairing, and printing
   the exact callback URL derived from the chosen `APP_URL`.
7. `APP_NAME` — write the env var and *report* the hardcoded occurrences
   (`layout.tsx:9-10`, `top-nav.tsx:31,35`, `page.tsx:54`,
   `sign-in/page.tsx:34,41,45`, `lotus-mark.tsx:27`) rather than rewriting
   source. A wizard that edits components is not re-runnable.
8. `LOG_LEVEL` — currently read at `logger.ts:9` but **absent from both
   `.env.example` and the env schema**, so an invalid value throws inside pino at
   module import. Add it to the schema with a pino-level enum regardless of the
   wizard.
9. Optional `COMPOSE_PROJECT_NAME` so two checkouts don't fight over the
   `padma-data` volume.

**Must never be configurable or auto-generated:** free-text `TRUSTED_ORIGINS`
(it is the cross-origin mutation trust anchor — a wizard-suggested wildcard or a
"add my LAN IP" convenience is a CSRF hole); the bind address / `--hostname`
(`dev.ts` pins `127.0.0.1` deliberately and mock auth is gated on loopback);
`AUTH_MODE="mock"` with a non-loopback `APP_URL` (and never "fix" that
validation error by flipping `NODE_ENV`); auto-answering `db push`'s data-loss
prompt; one generated value reused for both secrets. The wizard should also
assert `.env` is gitignored rather than assume it.

### Non-interactive / CI gaps

- CI re-declares the Postgres service instead of using `compose.yaml`, on port
  **5432** vs compose's **5433**. Two places to keep in sync; no CI compose profile.
- **CI never runs the seed**, so `prisma/seed.ts` regressions ship uncaught.
  `dev:prepare` is the only path that exercises it and it needs Docker.
- No `Dockerfile`, no `.dockerignore`, and `next.config.ts` sets no
  `output: "standalone"` — there is no container path for the app itself.
- No `.nvmrc` / `.node-version` / `.npmrc` with `engine-strict`; `engines` is
  unenforced, so a Node 20 user gets a warning rather than a failure.
- `docker compose up --wait` has no `--wait-timeout`, so a slow first-time image
  pull hangs unbounded.
- `dev.ts` has no SIGINT handler or child cleanup — nothing kills the `next dev`
  child if the parent exits abnormally.
- `path.resolve("node_modules", …)` in `dev.ts` is cwd-relative, so running from
  a subdirectory or a hoisted/monorepo layout yields `Cannot find module`.
- `generate:feature` on an existing feature surfaces a bare `EEXIST: mkdir …`
  rather than "feature already exists".

---

## 5. AI foundation for 1.0

Goal, per the maintainer: an AI API can chat, context persists within a chat,
chat histories are saved per user, and a model exists that lets an AI create
documents inside the app — enough baseline to build on without prescribing a
product direction.

Designed against the current Claude API (verified via the `claude-api` skill in
the session that wrote this — re-check before implementing, model IDs and beta
headers move).

### 5.1 Model configuration

- Default `claude-opus-5` (1M context, $5/$25 per MTok). SDK `@anthropic-ai/sdk`.
- Adaptive thinking is **on by default** on Opus 5 — omitting `thinking` thinks.
  `max_tokens` caps thinking *plus* response text, so size it accordingly.
- `output_config: { effort }` is the cost/latency lever; `low`/`medium` are
  unusually strong on this model. Do **not** try to shorten output via effort.
- Handle `stop_reason: "refusal"` **before** reading `content` — indexing
  `content[0]` unconditionally breaks on a refusal. Opt into
  `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) so
  cyber-category refusals route to Opus 4.8; benign security-adjacent work does
  occasionally trip the classifiers.
- Prompt caching is a prefix match with a 512-token minimum on Opus 5. Keep the
  system prompt frozen — no interpolated timestamps or user ids — and put
  volatile content after the last breakpoint. Verify with
  `usage.cache_read_input_tokens`.
- `ANTHROPIC_API_KEY` goes in the env schema, required when the feature is
  enabled. Never reaches the client; all calls are server-side.

### 5.2 Schema

```prisma
model Conversation {
  id        String   @id @default(uuid())
  ownerId   String   // required FK → User, onDelete: Cascade
  title     String
  model     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  archivedAt DateTime?
  @@index([ownerId, updatedAt])
}

model ConversationMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           MessageRole   // USER | ASSISTANT
  content        Json          // content blocks, as returned
  stopReason     String?
  model          String?
  inputTokens              Int?
  outputTokens             Int?
  cacheReadInputTokens     Int?
  cacheCreationInputTokens Int?
  createdAt      DateTime @default(now())
  @@index([conversationId, createdAt])
}

model AiDocument {
  id             String   @id @default(uuid())
  ownerId        String   // required FK → User, onDelete: Cascade
  conversationId String?  // provenance when created by a tool call
  title          String
  body           String
  format         String   // "markdown" initially
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([ownerId, updatedAt])
}
```

Ownership required from the first migration. Every read addressed by
`(ownerId, id)` **together** — the pattern the rewritten generator emits.
New permissions: `ai:converse`, `ai:document:read`, `ai:document:manage`.

### 5.3 Routes

```
POST   /api/ai/conversations                          create
GET    /api/ai/conversations                          list own
GET    /api/ai/conversations/{id}                     own, with messages
DELETE /api/ai/conversations/{id}                     own
POST   /api/ai/conversations/{id}/messages            send + stream response
GET    /api/ai/documents                              list own
GET    /api/ai/documents/{id}                         own
```

### 5.4 Three design points to settle before writing code

**Streaming removes the problem-response escape hatch.** Once the first byte is
written you cannot send an RFC 9457 problem response. The full required
operation order — origin, session, permission, rate limit, strict bounded body
parse, ownership — must complete *before* the stream opens. The handler needs
`request.signal` handling so a client disconnect still commits the partial
assistant message and its token usage. Order: commit the user message, call the
model, commit the assistant message on completion or abort.

**Prompt injection is a trust boundary Padma does not currently name.** Model
output is untrusted input. When the model requests `create_document`, the *model*
supplies content and the *server* supplies `ownerId` from the verified session —
never from tool input, same rule as "do not accept ownership from a client."
Tool input gets a strict Zod schema because it is caller-influenced data. Bound
tool invocations per turn. **Add this as a numbered invariant in AGENTS.md** —
it is the failure mode most likely to bite someone building on this starter, and
it is the natural extension of Padma's existing thesis.

**Token spend is an abuse vector against the operator's own API key.** Per-user
token budgets on top of the existing rate limiter, with usage persisted per
message for accounting and a documented ceiling.

### 5.5 Everything else follows existing patterns

Audit `ai:converse` and `ai:document:create`. Emit
`conversation.message.created` and `document.created` through
`enqueueIntegrationEvent` with `ownerId` set to the owner — the ownership model
built last session means a user's webhook receives their own events and nobody
else's. Feature lives at `src/features/ai/` following the generated slice shape.

---

## 6. Recommended sequence

Each step unblocks the next.

1. **Section 1 defects + `Field` primitive.** Roughly an hour. Removes a live
   accessibility failure that is currently modelled on the reference page.
2. **Prose styles, `Dialog`, `Toast`, `Spinner`, `ButtonLink`, `VisuallyHidden`,
   skip link.** Needed by the chat UI; also collapses the four duplicated copies
   of the primary-button class. Decide the code-block highlighting question here.
3. **`AppShell` / route-agnostic nav.** `TopNav`'s closed union blocks `/chat`.
4. **AI feature slice** (section 5), plus the prompt-injection invariant.
5. **Setup CLI** (section 4) — last, because by then the AI feature's config
   surface is known.
6. `Table` + `Pagination`, session-management UI, then the rest of section 2.

## 7. Reminders

```bash
npm run check          # typecheck + lint + tests with coverage thresholds
npm run build          # fail-closed production build
npm run db:reset       # discard the volume and rebuild from schema.prisma
npx prisma validate    # after any schema change, plus npm run db:generate
```

Schema changes: edit `prisma/schema.prisma`, run `npm run db:generate`, then
apply it with `npm run db:push` or rebuild with `npm run db:reset`. Migrations are
gitignored — do not commit them, and do not reintroduce `prisma migrate deploy`
to the dev path.

**Never make startup apply a schema change.** `npm run dev` compares the database
to the schema and refuses to start on divergence. Auto-applying would mean an
agent's schema edit silently rewrites local data on the next boot, where a dropped
column is indistinguishable from a feature that worked.

Production build needs `BETTER_AUTH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`,
`AUTH_MODE=oauth`, and a non-loopback `APP_URL`; it fails closed without them,
and `AUTH_MODE=mock` with a public `APP_URL` now refuses to boot by design.
