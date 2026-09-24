# Contributing to RestAssured

Thanks for helping music clubs keep track of their gear!

## Before you start

- Read [`CLAUDE.md`](CLAUDE.md). It holds the project rules for humans and AI agents alike.
- Architectural changes start with an ADR: see [`ai-docs/decisions/README.md`](ai-docs/decisions/README.md).
  If your change conflicts with an Active ADR, open an issue or a `Proposed` ADR first.

## Ground rules

- **Licence:** contributions are accepted under AGPL-3.0-or-later (inbound = outbound).
- **Sign-off:** every commit needs a Developer Certificate of Origin sign-off: `git commit -s`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), e.g.
  `feat(assets): bulk check-in (ADR-0015)`.
- **Dependencies:** only free software with a licence on the allow-list in
  [ADR-0009](ai-docs/decisions/ADR-0009-licensing-dependency-policy.md). Explain in the PR why a new
  dependency is needed and why a native or hand-written solution isn't enough.
- **Strings:** no hard-coded user-facing text. Add keys to both `locales/nl` and `locales/en`.
- **Tests & docs:** a change isn't done until its tests pass and affected docs are updated.

## Development setup

You need Node.js 26 (pinned in `.nvmrc`), pnpm 10 (pinned via `packageManager`), and Docker
Engine or Podman for the local database.

```sh
nvm install                 # or any Node 26 install
npm install -g corepack     # Node >= 25 no longer bundles Corepack
corepack enable             # already have a global pnpm? use `npm i -g pnpm@10` instead
pnpm install

cp .env.example .env
pnpm db:up                  # PostgreSQL 18 on 127.0.0.1:54320 (RA_CONTAINER_CLI=podman for Podman)
pnpm db:bootstrap           # roles ra_owner / ra_app + database (idempotent)
pnpm db:migrate
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm test:unit` | Unit tests (no database) |
| `pnpm test:integration` | Creates `restassured_test`, migrates, runs isolation and schema tests |
| `pnpm lint` / `pnpm format` | Prettier + ESLint |
| `pnpm check` | Svelte and TypeScript type check |
| `pnpm i18n:lint` | `nl`/`en` key parity, undefined and unused keys |
| `pnpm licenses:check` | Production dependency licences against `.license-policy.json` |
| `pnpm db:codegen` | Regenerate `src/lib/server/db/schema.d.ts` after a migration (CI checks it) |
| `pnpm db:reset` | Delete and recreate the local database container and volume |
| `pnpm docs:dev` | Docs site |

### Database changes

Add a new `db/migrations/NNNN_description.sql`; never edit an applied one (the runner refuses).
Every table with `tenant_id` needs RLS enabled and forced, the `tenant_isolation` policy, a
primary key starting with `tenant_id`, and a row in `tests/integration/fixtures.ts`. The schema and
isolation tests fail until all of that is in place. New columns on `users` or
`tenant_memberships` must be classified in `src/lib/server/db/pii.ts`.
