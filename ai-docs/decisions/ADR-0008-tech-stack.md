# ADR-0008: Technology Stack

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer
- **Related:** ADR-0001, ADR-0002, ADR-0007, ADR-0009, ADR-0010

## Context

The project is self-funded, public (AGPL-3.0, ADR-0009), and must be easy for other clubs to
self-host on a single small VM. We need server-side rendering with progressive enhancement
(`CLAUDE.md` lightweight budget), PostgreSQL row-level security (ADR-0001), and one language
across client and server so a small team (or one person plus agents) can maintain it.

## Decision

### Runtime & framework

| Concern | Choice | Licence | Notes |
|---|---|---|---|
| Language | TypeScript (strict) | Apache-2.0 | |
| Runtime | Node.js 24 LTS | MIT | Upgrade to each new Active LTS. |
| Framework | SvelteKit 2 + Svelte 5 | MIT | SSR, form actions that work without JS, small client bundles. |
| Adapter | `@sveltejs/adapter-node` | MIT | Single Node process behind a reverse proxy. |
| Package manager | pnpm | MIT | Lockfile committed; `pnpm-workspace.yaml` (app at root, `docs/` as a workspace package). |

### Data

| Concern | Choice | Licence | Notes |
|---|---|---|---|
| Database | PostgreSQL ≥ 16 | PostgreSQL | CI tests the oldest supported and the latest major. |
| Driver | `pg` | MIT | |
| Queries | Kysely | MIT | Typed query builder; raw SQL allowed via `sql` tag for RLS/advanced features. |
| Types from schema | `kysely-codegen` (dev) | MIT | Generated types committed. |
| Migrations | Plain, forward-only `.sql` files in `db/migrations/` + small in-house runner | — | RLS policies, grants and roles are SQL anyway; no ORM migration DSL. The runner takes a Postgres advisory lock and runs on app start (opt-out: `RA_MIGRATE_ON_START=false`). |

### Libraries (runtime)

| Concern | Choice | Licence |
|---|---|---|
| Input validation | Valibot | MIT |
| Password hashing | `@node-rs/argon2` | MIT |
| SMTP (optional) | Nodemailer | MIT-0 |
| QR codes for hand-over links | `qrcode` | MIT |
| Image re-encoding (logos, photos) | `sharp` | Apache-2.0 (bundles libvips, LGPL-3.0, dynamically linked) |
| Icons | Lucide (inline SVG, tree-shaken) | ISC |
| Charts | Hand-written SVG components | — |
| Fonts | System font stacks only | — |

No CSS framework, no component kit, no state-management library, no CSS-in-JS: plain Svelte
components with scoped CSS and the `--ra-*` tokens (ADR-0002).

### Tooling (development only)

| Concern | Choice | Licence |
|---|---|---|
| Unit/integration tests | Vitest | MIT |
| E2E tests | Playwright | Apache-2.0 |
| Accessibility checks | `@axe-core/playwright` | MPL-2.0 (dev only, not distributed) |
| Lint / format | ESLint, Prettier, `svelte-check` | MIT |
| Local Postgres | Docker Compose file (Docker Engine or Podman) | Apache-2.0 |
| Docs site | VitePress (+ Mermaid) | MIT |

### Process model

- One Node process serves SSR pages, form actions and JSON endpoints (`+server.ts`).
- Periodic housekeeping (expired sessions/tokens cleanup, inactivity reminders) runs in-process on
  a timer guarded by a Postgres advisory lock. No external queue or cron.
- Rate limiting is stored in Postgres (a small counter table) so it works across restarts and
  multiple instances.
- Configuration comes only from environment variables, parsed and validated at startup by one
  config module; the process refuses to start on invalid config.

### Repository layout

```
src/
  lib/server/        # server-only: db, tenancy, auth, rbac, gdpr, forecasting adapters
  lib/domain/        # pure logic (forecasting engine, permission catalogue, theme validation)
  lib/components/    # UI components
  lib/i18n/          # t(), formatters
  routes/            # /t/[tenant]/…, /platform/…, /auth/…
db/migrations/       # NNNN_description.sql
locales/{nl,en}/     # dictionaries (ADR-0007)
docs/                # VitePress site + SYSTEM_SPEC.md (ADR-0010)
ai-docs/             # ADRs and agent prompts
tests/               # integration, isolation, e2e
```

## Consequences

### Positive
- Everything is free and open source; every licence is compatible with AGPL-3.0 (ADR-0009).
- Self-hosting is one container + Postgres.
- Server-first rendering keeps JS small and makes core flows work on poor connections.

### Negative / trade-offs
- SvelteKit major upgrades may require migration work.
- `sharp` ships native binaries; unusual platforms may need a build from source. It's the only
  native dependency besides `@node-rs/argon2` (which ships prebuilt binaries).
- Writing our own migration runner and charts is extra code, but little code.

### Follow-ups
- ADR-0001's minimum PostgreSQL version is raised to 16 by this ADR.
