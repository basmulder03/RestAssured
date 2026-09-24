# ADR-0011: CI, Source Hosting & Release Process

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer
- **Related:** ADR-0008, ADR-0009, ADR-0010

## Context

The code is hosted publicly on GitHub (repository name/URL still to be decided). The maintainer
wants CI and pushes to GitHub from the start, but **no automated deployment until the application
is feature-complete (v1.0)**. All CI must be free (ADR-0009).

## Decision

### 1. Source hosting

- GitHub, public repository. Default branch `main`, protected once the repository exists: PRs
  required, CI green, linear history (squash merges).
- No repository-specific values (owner, repo name, URLs) are hard-coded in code or workflows.
  Workflows use the `github.repository` context, the app uses `RA_SOURCE_URL`, and the docs
  `base` comes from the repo name.
- Conventional Commits with DCO sign-off (`-s`). Reference ADRs in commit subjects where relevant.

### 2. Continuous integration (GitHub Actions, free for public repos)

Runs on every push and PR:

| Job | Content |
|---|---|
| `lint` | ESLint, Prettier check, `svelte-check`, TypeScript |
| `unit` | Vitest (domain logic, forecasting tables) |
| `integration` | Vitest against PostgreSQL service containers (min supported + latest major): migrations, RLS isolation, handlers |
| `schema-lint` | RLS enabled + forced on all tenant tables, PII annotations complete |
| `i18n-lint` | `nl`/`en` key parity, undefined/unused keys |
| `e2e` | Playwright + axe on the built app with seeded data |
| `licenses` | `dependency-review-action` (PRs) + prod licence allow-list check (ADR-0009) |
| `build-image` | Builds the Docker image to check the Dockerfile. **Not pushed.** |
| `docs` | VitePress build (and Pages deploy on `main`, ADR-0010) |

Also enabled: Dependabot (npm, GitHub Actions, Docker), CodeQL, secret scanning, and private
vulnerability reporting (`SECURITY.md`).

### 3. No automated deployment before v1.0

- No workflow deploys the application anywhere, and none publishes container images, until v1.0.
  The maintainer's own instance is updated manually (pull + build or `docker compose build`).
- Versioning: SemVer tags `v0.x.y` during development. A `CHANGELOG.md` is kept by hand (Keep a
  Changelog format).
- When v1.0 is reached, a new ADR will define image publishing to GHCR (free for public images),
  signed release tags, and optionally deployment automation for the maintainer's instance.

## Consequences

### Positive
- The quality gates are in place from the first commit, at zero cost.
- Forks get working CI and docs publishing without edits.

### Negative / trade-offs
- Until v1.0, self-hosters must build the image themselves (documented, one command).
- Two Postgres majors in the integration matrix roughly double that job's time. Acceptable on free
  runners.
