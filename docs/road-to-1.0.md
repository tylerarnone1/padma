# Road to 1.0

This is Padma's internal source of truth through the 1.0 release. It records
what we are building, why it matters, what has been decided, and what comes
next. Detailed designs belong in ADRs and implementation issues when the work
begins.

Last reviewed: July 29, 2026.

## North star

Padma is the web application foundation people choose because it looks good,
starts fast, and already contains the features they expect. Its deeper value is
that the safe way to extend the application is also the easiest way.

The primary audience is an AI-assisted builder who may not know which
architectural or security decisions need to be made before shipping. Padma and
its agent rules establish those lanes up front so later prompts extend the same
system instead of inventing parallel authentication, authorization, data, and
integration paths.

Security is part of the product, not the marketing burden. Lead with what
people can build; let the foundation quietly make the result harder to misuse.

## What 1.0 must feel like

A first-time user should be able to:

- understand the value from the landing page in under a minute;
- clone, configure, and run the app without debugging the starter;
- choose whether the product serves individuals, one team, or many customer
  organizations without needing to understand tenancy jargon;
- generate a useful feature that follows the existing authorization, data,
  validation, audit, and integration patterns;
- customize the brand and product without fighting the foundation;
- see enough polished, practical functionality that starting from scratch
  feels like the worse option;
- confidently continue working with a coding agent after the initial setup.

The measurable golden path is: **clone to one working, protected feature in
under ten minutes on a clean machine.**

## Product principles

1. **Attraction first.** Visual polish, useful features, and a fast start earn
   adoption. Security should strengthen that experience without becoming a
   lecture.
2. **One obvious lane.** Every common operation has an established path that
   agents can find, copy, and test.
3. **Safe defaults, explicit escape hatches.** Important ownership and trust
   decisions cannot be skipped silently. Advanced products can override a
   default through a documented decision.
4. **Product-neutral core, opinionated recipes.** The foundation owns
   cross-cutting primitives. Example products demonstrate how to compose them
   without turning Padma into a CRM, portal, or project manager.
5. **Proof over claims.** Important promises should eventually point to a test,
   generated artifact, working example, or reproducible evaluation.
6. **Progressive complexity.** A solo builder should not pay the conceptual
   cost of multi-tenant SaaS, while a SaaS builder should not need to replace
   the authorization model.

## Decisions already made

These are roadmap-level decisions. Their implementation details will be
captured separately when needed.

### One application, configurable ownership topology

Padma will not maintain separate B2C, internal-tool, and B2B applications. It
will use one common ownership boundary with setup-selected behavior:

| Setup choice | Product behavior |
| --- | --- |
| Individual accounts | Each user works in a personal scope. |
| One team or business | Approved users share one organization scope; tenant creation and switching are absent. |
| Many customer organizations | Users can create or join organization scopes; membership is resolved for every scoped operation. |

A future hybrid may expose personal and organization scopes together. The
internal name is currently `OwnershipScope`; the final name will be settled in
the topology ADR.

Platform administration and customer-data access remain separate. Being a
Padma administrator must never silently grant access to every organization's
records.

### Ownership remains a feature decision

Choosing a product topology does not decide who may access every record. The
feature generator will ask whether a resource is:

- shared within its scope;
- private to an actor within a scope;
- publicly readable but scope-managed;
- application-wide; or
- governed by a custom multi-party policy.

Creation history is not ownership, and public visibility is a read policy—not
the absence of an owner.

### Setup records decisions; it does not create forks

The setup experience will ask plain-language questions and record the selected
topology and terminology in generated source and project documentation. It
must not hide a security-significant choice only in an environment variable.

Feature and project generation should compose from the same primitives rather
than copy whole application variants.

### The core stays provider-neutral

Email, storage, AI, and external integrations will expose stable application
seams with replaceable providers. Recipes may choose a reference provider;
domain code will not depend directly on one.

### The landing page is a product asset

The current animated landing experience establishes the desired wow factor.
Future work should preserve its personality, reduced-motion behavior, and
performance, then carry the same level of polish into setup and the signed-in
application.

### Starter UI: one product, not a gallery of templates

Padma will ship a coherent signed-in application rather than unrelated example
pages. The core surface should include:

- a useful dashboard;
- onboarding;
- profile, security, and session management;
- members, invitations, roles, and permissions when the selected topology has
  a team;
- integrations and delivery health;
- an activity/audit timeline;
- account settings and consistent loading, empty, denied, not-found, and error
  states.

Reusable page blueprints will cover the patterns builders repeat most:
collection/table, resource detail, create/edit form, settings section, import
wizard, dashboard, activity timeline, and confirmation flow. These blueprints
should be demonstrated in real pages, not only in the component workshop.

Next.js filesystem routing remains the source of truth. Padma will not build a
second router. Route groups and nested layouts will separate marketing, auth,
and product surfaces. Typed routes will catch invalid links.

Navigation will be centrally composable without becoming an authorization
boundary. Features own typed navigation descriptors for label, destination,
group, icon, permission, and supported topology; the application shell
assembles them. Hiding a navigation item never replaces authorization in the
page, service, or repository.

The default signed-in shell will use:

- a sidebar for primary product navigation;
- a top utility bar for search, scope, notifications, and the user menu;
- the same registry rendered as a mobile drawer;
- local tabs or sub-navigation where a section needs them.

Public pages keep a marketing header. Alternative shell treatments belong in
the development workshop rather than appearing inconsistently across product
pages.

### Components are part of Padma's product value

Padma will own the design language, component API, semantic tokens, and
compositions that make the starter recognizable. Complex interactive behavior
may use a proven headless foundation; custom design does not require
reimplementing focus management or other accessibility machinery.

Build the library in three layers:

1. **UI primitives** — controls, dialog, menu, toast, tabs, feedback, loading,
   and table foundations.
2. **Product compositions** — application shell, navigation, page headers, data
   tables, filters, pagination, statistics, forms, settings, imports, and
   activity timelines.
3. **Padma differentiators** — local persona and scope switching, permission
   exploration, audit and delivery inspectors, and a permission-aware AI
   command surface.

The component workshop remains the isolated development surface. Actual starter
pages prove that the components compose into a desirable product.

### Session activity is a root-layout invariant

Inactivity handling must work consistently across every page. Padma will mount
one session-activity bridge in the top-level root layout so route changes,
nested layouts, generated pages, and custom product layouts inherit the same
behavior automatically. A feature must not implement its own competing idle
timer.

For an authenticated session, the client may treat pointer movement, pointer
actions, keyboard interaction, touch, scrolling, window focus, and page
visibility as activity signals. It will record only that meaningful activity
occurred—not cursor coordinates, pressed keys, DOM content, or a replay of user
behavior. Signals and server heartbeats must be throttled so ordinary cursor
movement does not produce continuous network requests or database writes.

The system will distinguish:

- **idle timeout** — expires a session after a configurable period without
  meaningful activity;
- **absolute lifetime** — expires a session after a maximum age even if the
  user remains active;
- **recent MFA** — remains a separate requirement for sensitive operations and
  is never refreshed by ordinary activity.

The browser provides warning and continuation UX, but it is not the security
authority. The server records bounded activity heartbeats and rejects an idle
or absolutely expired session on every protected path. Client-side logout alone
is insufficient.

Multiple tabs must coordinate activity and expiry so they behave as one browser
session. Activity counts only while a page is visible or its window is focused;
background tabs cannot keep a session alive indefinitely. Idle expiry should
propagate promptly to every open tab.

The root-layout integration is part of Padma's agent contract and verification
suite. Nested layouts may change presentation but must not bypass it. If the
application ever permits an alternative root layout, that layout must satisfy
the same tested contract before it can serve an authenticated page.

## Roadmap

The phases are ordered. Adoption work runs alongside engineering rather than
waiting until the code is complete.

### Phase 0 — Establish the foundation

**Status: complete**

- Secure authentication with a deliberately isolated local mock mode.
- Default-deny permissions, ownership policies, strict validation, and
  non-disclosure patterns.
- Recent-MFA protection for sensitive actions.
- Audit, transactional outbox, signed webhooks, retry boundaries, and SSRF
  defenses.
- A feature generator that produces the established slice structure and
  requires an ownership decision.
- Theme generation, contrast protection, component workshop, and the first
  accessibility pass.
- A distinctive animated landing page and clearer public positioning.
- Schema-as-source-of-truth local development with fail-closed startup.

### Phase 1 — Nail the first ten minutes

**Status: in progress**

- `npm run setup` now provides environment preflight, coordinated ports,
  persistent development secrets, safe re-runs, and fail-closed database
  preparation.
- Ask the product-topology questions in ordinary language.
- Make mock sign-in and the first generated feature immediately discoverable.
- Improve generator errors and first-run diagnostics.
- Validate the full path on a clean machine and measure the time.
- Record the real terminal-to-browser flow for the README and launch material.

**Exit condition:** a new user can clone Padma and reach a working protected
feature in under ten minutes without external credentials.

### Phase 2 — Make it feel like a real product

**Status: planned**

- Create the shared product layout, typed navigation registry, and polished
  responsive app shell.
- Finish the essential UI set: dialogs, toasts, loading states, tables,
  pagination, empty states, menus, and accessible form controls.
- Replace the foundation-only dashboard with a useful product dashboard.
- Add onboarding, profile, security, session management, and the minimum
  user/role administration experience.
- Add root-layout activity detection, coordinated multi-tab idle warnings, and
  server-enforced idle and absolute session expiration.
- Add integrations, activity, and account-setting starter pages.
- Add provider-neutral email and file-storage foundations.
- Add health/readiness and a clear worker/scheduling path.
- Resolve request idempotency before retry-prone paid operations depend on it.

**Exit condition:** a builder can ship a credible CRUD or operations product
without first constructing basic application infrastructure.

### Phase 3 — Make customization powerful

**Status: planned**

- Formalize the shared ownership-scope model and topology resolvers.
- Extend generation from a code slice into a useful resource: schema, forms,
  table, policy, permission, and adversarial tests.
- Support personal, single-organization, and multi-organization projects
  through the same service and repository contracts.
- Make naming, branding, navigation, and feature selection setup concerns.
- Publish the first removable product recipe as a coherent CSV-to-pipeline
  workflow rather than a collection of disconnected demo pages.

Initial recipe targets reflect what people are commonly building:

- an operations tracker or lightweight CRM;
- a client/customer portal;
- a CSV-to-dashboard workflow;
- a booking or request-management flow.

Recipes are examples and test beds, not permanent product domains in core.

**Exit condition:** the same generated feature works across the supported
topologies without application forks or weakened ownership checks.

### Phase 4 — Add the memorable capabilities

**Status: planned**

- Add a permission-aware AI foundation with bounded tools and spend controls.
- Decide whether saved chat is a core primitive or a removable reference
  feature before committing its product schema.
- Add an AI command surface that can act through normal application services,
  never around them.
- Add CSV import and a polished data-to-workflow experience.
- Add developer-facing permission/persona switching for local evaluation.
- Add visual audit, event, and delivery inspectors that make the invisible
  architecture tangible.
- Expand integration adapters without leaking providers into domain code.

The flagship demo should tell one coherent story: import leads, see a pipeline,
ask AI for a summary, invite a teammate, create an output, and inspect the audit
and event trail.

**Exit condition:** Padma has at least one genuinely useful, visually compelling
workflow that is difficult to reproduce safely from an empty project.

### Phase 5 — Prove it and release it

**Status: planned**

- Build agent evaluations for ownership isolation, MFA coverage, strict input,
  atomic side effects, and idempotent retries.
- Publish a concise control matrix separating included protections from
  adopter-owned infrastructure.
- Test clean-machine setup, a fresh database, production configuration, and the
  documented deployment path.
- Publish versioned recipes, upgrade notes, a changelog, and tagged pre-1.0
  releases.
- Prepare a short demo video/GIF, screenshots, focused examples, and
  contributor-friendly issues.
- Perform the final accessibility, security, dependency, and documentation
  review.

**Exit condition:** every important 1.0 claim has evidence, the golden path is
repeatable, and a new adopter can tell what Padma provides and what they still
own.

## 1.0 release gates

Padma is ready for 1.0 when all of the following are true:

- `npm run check` and `npm run build` pass from a clean checkout.
- Clone-to-protected-feature stays under the ten-minute budget.
- All three supported topology choices have isolation tests.
- Every authenticated page inherits the same session-activity system, and
  protected requests fail after server-authoritative idle or absolute expiry.
- Multi-tab activity, warning, continuation, and logout behavior have regression
  coverage.
- Generated features fail closed until ownership is declared.
- Sensitive operations consistently require recent MFA.
- Core side effects use the audit/outbox lane and retry safely.
- The production checklist clearly names external responsibilities.
- At least one removable recipe demonstrates a complete, desirable workflow.
- The landing page, setup flow, and signed-in shell feel like one product.
- Starter pages use one navigation system and demonstrate the reusable page
  blueprints in realistic states.
- Agent evaluations exercise the security rules against unseen change prompts.
- No known critical or high-severity defect remains open.

## Decision queue

Only decisions that can materially change the roadmap belong here:

1. **Ownership-scope ADR:** settle naming, lifecycle, membership, and
   platform-versus-scope authorization before changing the schema.
2. **AI placement:** decide core primitive versus removable recipe before
   creating conversation tables or public API contracts.
3. **Reference providers:** select the initial email and storage adapters when
   Phase 2 begins.
4. **Billing:** decide whether subscriptions are a 1.0 primitive or the first
   post-1.0 recipe before Phase 3 scope is locked.
5. **Recipe order:** validate the first flagship workflow with potential users
   before building multiple examples.

## Known gaps

These are tracked here so they are not mistaken for existing capability:

- Setup now automates local configuration and database preparation; topology
  recording and full clean-machine golden-path validation remain.
- Product topology and organization membership are designed at roadmap level
  but not implemented.
- Session activity detection and server-enforced inactivity timeout are not yet
  implemented.
- Session/user administration, email, file storage, pagination, readiness, and
  worker scheduling are incomplete or absent.
- Request idempotency has a persistence model but no complete request path.
- The AI foundation and product recipes are not built.
- The signed-in product shell does not yet match the landing page's polish.
- Public proof, agent evaluations, and the launch demo still need to be created.

## Not a 1.0 goal

- Supporting every possible tenancy or marketplace relationship.
- Becoming a no-code visual application builder.
- Shipping a full CRM, commerce platform, CMS, or project-management product in
  core.
- Provisioning an adopter's cloud infrastructure.
- Pretending agent rules or framework defaults make an application
  automatically secure.
- Maximizing the number of integrations at the expense of stable primitives.

## How to maintain this roadmap

- Update phase status and known gaps when work lands.
- Add a roadmap item only when it affects the path to 1.0.
- Put implementation plans in issues and lasting technical decisions in ADRs.
- Do not duplicate detailed task lists here.
- Revisit the decision queue at the start of the phase it blocks.
- Rewrite or archive this document at the 1.0 tag.
