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

Setup instructions will follow once the application scaffold lands. You'll need Node.js 26
(pinned in `.nvmrc`), pnpm (pinned via `packageManager` in `package.json`), and Docker Engine or
Podman for a local PostgreSQL.

Docs site only:

```sh
nvm install              # or any Node 26 install
npm install -g corepack  # Node >= 25 no longer bundles Corepack
corepack enable          # already have a global pnpm? use `npm i -g pnpm@10` instead
pnpm install
pnpm docs:dev
```
