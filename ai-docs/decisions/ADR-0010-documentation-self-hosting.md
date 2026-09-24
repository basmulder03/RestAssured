# ADR-0010: Documentation Strategy & Self-Hosting Model

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer
- **Related:** ADR-0007, ADR-0008, ADR-0009, ADR-0011

## Context

Other clubs will deploy RestAssured without talking to the maintainer, and club admins who are not
developers will use it. The documentation has to answer "how do I run this?" and "how do I use
this?" without a support channel. Contributors (people and AI agents) need to understand the code
without wading through comment noise.

## Decision

### 1. Documentation in code: concise, only where needed

- Comments explain **why**, constraints, or non-obvious behaviour. They never restate what the code
  says. Names and types do the rest.
- Exported functions in `src/lib/domain/` and `src/lib/server/` get a short TSDoc line when their
  contract isn't obvious from the signature (units, invariants, side effects, security
  assumptions). No `@param` boilerplate for self-explanatory parameters.
- Security- and tenancy-critical code references its ADR in one line, e.g.
  `// ADR-0001: set_config is transaction-local so pooled connections can't leak tenant context.`
- Each feature module may have a short `README.md` (≤ ~30 lines) when its structure isn't obvious.
- No generated API reference site. The code plus TSDoc is the reference.

### 2. Static docs site: VitePress on GitHub Pages

- Source lives in `docs/` (a pnpm workspace package). Published to GitHub Pages by a GitHub
  Actions workflow on every push to `main` that touches `docs/` or `ai-docs/decisions/`.
  Publishing documentation isn't an app deployment, so it is exempt from the "no auto-deploy"
  rule in ADR-0011.
- The `base` path comes from the repository name at build time, so forks publish correctly
  without edits.
- ADRs are copied from `ai-docs/decisions/` into the site at build time (not duplicated in git).
- Site structure:

  | Section | Audience | Languages |
  |---|---|---|
  | Introduction (what, why, screenshots) | Everyone | en, nl |
  | Self-hosting: requirements, Docker Compose quick start, configuration reference, first Super Admin, reverse proxy/TLS, SMTP, backups & restore (incl. erasure replay), upgrades, AGPL obligations | Operators | en |
  | User guide: Super Admin, Tenant Admin (theme, roles, members, reset links, anonymization), Quartermaster (assets, checkouts), Treasurer (forecasts), Member | Club volunteers | nl, en |
  | Privacy & GDPR for clubs: controller/processor roles, privacy-notice template, processor-agreement template (CC0) | Club boards | nl, en |
  | Architecture: system spec, ADRs | Contributors | en |
  | Contributing: dev setup, conventions, testing, licence policy | Contributors | en |

- Operator and contributor docs are English only (wider reach, less maintenance). End-user docs
  are Dutch and English, like the app.

### 3. Docs stay in sync with behaviour

- A PR that changes user-visible behaviour, configuration, or deployment updates the relevant docs
  page in the same PR (PR template checklist).
- The configuration reference is generated from the config schema module at docs build time, so
  it can't drift.
- Screenshots come from Playwright runs against seeded demo data (a script, not manual work).

### 4. Self-hosting model

- **Artifact:** one container image (multi-stage `Dockerfile`, non-root user, Node 24 slim base)
  plus PostgreSQL. A reference `compose.yaml` includes `app`, `postgres`, and optionally `caddy`
  (Apache-2.0) for automatic TLS.
- **Also supported:** running with plain Node + an existing Postgres (documented, not the default).
- **Bootstrap:** on first start with an empty database, the app refuses platform access until an
  operator runs `node build/cli.js create-super-admin --email …` (or the container equivalent).
  That prints a one-time login link (ADR-0004), so no default passwords exist.
- **Single-club operators** use the same multi-tenant app with one tenant. There's no separate
  mode to maintain.
- **Backups:** documented `pg_dump` script + retention; restore procedure includes
  `replay-erasures` (ADR-0005).
- **Upgrades:** pull the new image and restart. Migrations run on start (ADR-0008). Release notes
  flag any manual steps.

## Consequences

### Positive
- New operators can go from clone to running club in under 30 minutes without contacting anyone.
- Docs are versioned with the code and published for free.

### Negative / trade-offs
- Keeping Dutch and English user guides in sync is ongoing work. English is written first, and
  Dutch pages show a "translation may be behind" banner when their source hash differs.
