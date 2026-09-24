# CLAUDE.md — RestAssured

## Project summary

**RestAssured** is a lightweight, multi-tenant web application for music clubs, marching bands,
and orchestras (e.g. Dutch *harmonieën*, *fanfares*, *drumbands*) to track instruments, uniforms,
accessories, and cases; see who has what; and forecast depreciation, maintenance, and replacement
budgets. Users are volunteers on phones and old laptops; clubs are non-profits with tiny budgets.

Core ideas:
- Many clubs (tenants) on one deployment, strictly isolated.
- One person can belong to several clubs and switch between them.
- Clubs brand the app with their own colours and logo.
- Club-defined roles built from a fixed catalogue of fine-grained permissions.
- Magic-link / admin-issued-link auth; no mandatory email provider.
- GDPR erasure that keeps asset history intact.
- Dutch and English from day one.

## Before you change anything architectural

1. **Read `ai-docs/decisions/`.** Check the index in `ai-docs/decisions/README.md` and read every
   Active ADR related to your change *before* suggesting or implementing it.
2. If your idea conflicts with an Active ADR, **stop and say so**. Draft a superseding ADR with
   status `Proposed`; do not work around the ADR in code.
3. Agent role prompts live in `ai-docs/agents/`. The system spec is `docs/SYSTEM_SPEC.md`.

## Project constraints

- **Self-funded, public, AGPL-3.0-or-later.** The maintainer pays for everything, so nothing may
  cost money: no paid licences, tiers, or SaaS (ADR-0009). Anyone must be able to clone, fork and
  self-host for free (ADR-0010).
- **Licences:** before adding any dependency, check its licence against the allow-list in
  ADR-0009. GPL-2.0-only, SSPL, BUSL, "non-commercial" and unlicensed packages are forbidden.
  Every source file starts with `SPDX-License-Identifier: AGPL-3.0-or-later`.
- **No automated deployment or image publishing until v1.0** (ADR-0011). CI runs on every push to
  GitHub. The repository URL is not decided yet, so never hard-code owner, repo name, or URLs.

## Commands

Node via nvm (`nvm use`), pnpm from `packageManager`. Local DB: `pnpm db:up && pnpm db:bootstrap
&& pnpm db:migrate` (port 54320). Before pushing: `pnpm lint && pnpm check && pnpm test &&
pnpm i18n:lint`. After a migration: `pnpm db:codegen`. `main` is protected: branch, sign off
(`git commit -s`), open a PR. Full list in `CONTRIBUTING.md`.

## Stack (ADR-0008)

SvelteKit 2 + Svelte 5 (`adapter-node`), TypeScript strict, Node.js 26 LTS, pnpm, PostgreSQL ≥ 16
via `pg` + Kysely, plain `.sql` migrations, Valibot, Vitest, Playwright, VitePress for docs.
See ADR-0008 for the full, licence-checked list. Anything not listed there needs justification.

## Architectural rules (non-negotiable)

### Multi-tenancy (ADR-0001)
- Every tenant-owned table has `tenant_id uuid NOT NULL`, composite keys `(tenant_id, id)`,
  composite FKs, and RLS **enabled and forced**.
- All tenant data access goes through `withTenant(tenantId, fn)`, which opens a transaction and
  sets `app.tenant_id` transaction-locally. Queries *also* filter `tenant_id` explicitly.
- Tenant context comes from the URL (`/t/{slug}/…`), is verified against an active membership on
  every request, and unknown/non-member tenants return **404**.
- `users` is global identity; `tenant_memberships` is a person in a club. Most members are
  references without a login (`user_id` NULL); only people who manage inventory get an account. Assignments reference `membership_id`, never `user_id`.
- Platform (Super Admin) routes live under `/platform/…` and have **no implicit tenant data
  access**; support access is explicit, time-boxed, and audited.

### Multi-tenant user context
- The session identifies a *user*; the URL identifies the *tenant*; the request context carries
  `{ user, tenant, membership, permissions, locale }`. Never cache permissions across requests
  without a version check.
- The tenant switcher lists the user's active memberships; switching is navigation.
- Sessions created from a tenant-admin-issued reset may be `scoped_tenant_id`-restricted
  (ADR-0004 §4). Respect that flag in tenant resolution.

### Authorization (ADR-0003)
- Every route declares scope (`public` | `platform` | `tenant`) and required permission(s).
  Use `requirePermission('assets:edit')`; never check role *names*.
- Permissions are code constants in `permissions.ts`; roles are tenant data.
- Financial fields (`purchase_price`, `insured_value`) are stripped from responses unless the
  caller has `assets:view_financials`.
- Guards: no privilege escalation; the last Tenant Admin cannot be removed.

### Theming (ADR-0002)
- Components use `var(--ra-*)` tokens only — no literal brand colours.
- Tenant theme values are typed and validated (hex/enum) and injected as a nonce'd inline
  `<style>` in `<head>`. Never interpolate tenant input into CSS/HTML any other way.
- No SVG logo uploads.

### Language / i18n (ADR-0007)
- Supported locales: `nl` (default & fallback) and `en`.
- **No user-facing literal strings** in code: use `t('feature.key', params)`. Add the key to both
  `locales/nl/*.json` and `locales/en/*.json` in the same change.
- APIs return error **codes** (`assets.serial_duplicate`) + params, never prose.
- Format money, dates, and numbers with `Intl`. Money is integer cents internally.
- System entities store `label_key`; tenant-defined entities store `label_i18n` (`{nl, en}`).
- Never display raw enum values; never store generated display text (e.g. anonymized names).

### GDPR (ADR-0005)
- Every column on PII-bearing tables is annotated (`pii: true|false`). Free text is PII.
- Audit logs store IDs and field names, never PII values.
- Anonymization scrubs PII but keeps rows and history; pseudonyms are random, not derived.

### Forecasting (ADR-0006)
- The engine is pure and deterministic (reference year is an input). Integer cents at
  boundaries. Formulas in `docs/SYSTEM_SPEC.md §6` are the contract.

## Lightweight design principles

- **Budget:** initial route ≤ 100 KB gzipped JS and ≤ 30 KB CSS; server idle RSS ≤ 150 MB;
  runs on a single small VM + Postgres.
- Prefer platform features: `Intl`, `crypto.randomBytes`, `color-mix()`, native `<dialog>`,
  HTML forms. Prefer Postgres over new infrastructure (no Redis, queues, or search engines
  without an ADR).
- Every new runtime dependency needs a one-paragraph justification in the PR (size, maintenance
  status, why not native/hand-rolled).
- Server-render first; progressive enhancement; core flows work without JS.
- Mobile first (360 px), keyboard accessible, WCAG 2.2 AA.

## Coding conventions

- TypeScript strict; no `any` without a `// reason:` comment. Validate all external input at the
  boundary with a schema; internal code trusts typed values.
- Naming: DB `snake_case`; TS `camelCase` values, `PascalCase` types; permission strings
  `resource:action`; i18n keys `feature.sub.key` (lower_snake segments).
- Modules by feature (`assets/`, `assignments/`, `members/`, `auth/`, `rbac/`, `theming/`,
  `forecasting/`, `gdpr/`, `platform/`), each with its handlers, service, repository, and tests.
- Money: `bigint`/integer cents, never floats at rest. Timestamps `timestamptz` in UTC.
- Errors: throw typed domain errors carrying an i18n code; map to HTTP at the edge.
- Logging: structured; never log tokens, password material, or PII values.
- Commits: Conventional Commits with DCO sign-off (`git commit -s`), referencing ADRs where
  relevant: `feat(rbac): … (ADR-0003)`.

## Documentation (ADR-0010)

- **In code:** concise, only where needed. Comment *why*, invariants, units, and security
  assumptions, never *what*. Short TSDoc on exported domain/server functions whose contract isn't
  obvious. Tenancy/security-critical code cites its ADR in one line.
- **Docs site:** VitePress in `docs/`, published to GitHub Pages. Operator and contributor docs in
  English. User guides and the club privacy kit in Dutch and English.
- A change to user-visible behaviour, configuration, or deployment updates the docs in the same
  change.

## Testing requirements

| Layer          | Required for                                        |
|----------------|-----------------------------------------------------|
| Unit           | All domain logic; forecasting formulas (table-driven, hand-calculated) |
| Integration (real Postgres) | Every handler: happy path, 403 missing permission, 404 foreign tenant, 400 validation code |
| Isolation      | Every tenant table: cross-tenant read/write yields zero rows / fails |
| Schema lint    | RLS enabled+forced on all tenant tables; PII annotations complete |
| i18n lint      | `nl`/`en` key parity; no undefined or unused keys   |
| E2E            | Login via link, tenant switch, asset checkout/return, role matrix edit, anonymization |
| Accessibility  | Automated axe check on key pages, no serious/critical issues |

Tests must run against a real PostgreSQL (container) — never mock the database for isolation or
RLS tests. A change is not done until its tests pass locally and in CI.
