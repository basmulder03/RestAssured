# ADR-0009: Project Licence, Dependency Licence Policy & Zero-Cost Tooling

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer
- **Related:** ADR-0008, ADR-0010, ADR-0011

## Context

- The maintainer pays for everything personally and hosts RestAssured for a few clubs they
  belong to. There is no budget for licences, paid SaaS, or paid tiers.
- The repository is public. Any club should be able to clone, fork and deploy it for free.
- Improvements made by people who run modified versions as a service should flow back to the
  community, rather than ending up in closed commercial forks.

## Decision

### 1. Project licence: AGPL-3.0-or-later

- The full licence text is in `LICENSE`. Every source file (`.ts`, `.svelte`, `.js`, `.sql`,
  `.css`) starts with one line:
  `SPDX-License-Identifier: AGPL-3.0-or-later` (in that file type's comment syntax).
  No other boilerplate headers.
- **AGPL §13 (network use):** every page footer shows a "Source code" link. Its target comes
  from `RA_SOURCE_URL` and defaults to the upstream repository. The self-hosting docs explain that
  operators running a *modified* version must point it at their own public source.
- Documentation (`docs/`) is also covered by the repository licence. Templates meant for clubs to
  adapt (privacy notice, processor agreement) are additionally offered under CC0-1.0 so clubs can
  reuse them freely. These files say so in their header.

### 2. Contributions

- Inbound = outbound: contributions are accepted under AGPL-3.0-or-later.
- Contributors sign off commits (Developer Certificate of Origin, `git commit -s`). There is no CLA.
- Consequence: relicensing later would need every contributor's consent. This is accepted.

### 3. Third-party licence policy

Applies to everything **shipped** (runtime dependencies and anything bundled into the container
image or client bundle).

| Category | Licences | Rule |
|---|---|---|
| Allowed | MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, Zlib, Unlicense, CC0-1.0, BlueOak-1.0.0, PostgreSQL, Python-2.0 | Use freely. |
| Allowed with review | MPL-2.0, LGPL-2.1-or-later, LGPL-3.0, GPL-3.0, AGPL-3.0, CC-BY-4.0 (assets only) | Note the reason in the PR. LGPL only via dynamic linking. |
| Forbidden | GPL-2.0-only, SSPL, BUSL, Elastic License, Commons Clause, FSL, any "non-commercial" licence (CC-BY-NC…), proprietary, missing/unknown licence | Never. GPL-2.0-only is incompatible with AGPL-3.0. |

- Dev-only tooling that is never distributed may use any OSI-approved licence, but must still be
  free of cost.
- Enforcement in CI (ADR-0011):
  1. `actions/dependency-review-action` (free for public repos) on pull requests, configured
     with the allow-list above.
  2. A `pnpm licenses list --prod --json` check against `.license-policy.json` on every build,
     which catches transitive dependencies too.
- Fonts: system fonts only (no font licensing). Icons: Lucide (ISC). Illustrations must be
  CC0/CC-BY or self-made.

### 4. Zero-cost services & tooling

- Allowed: services that are free for public open-source repositories (GitHub Actions, GitHub
  Pages, GitHub Container Registry, Dependabot, CodeQL, secret scanning), and free open-source
  software run locally or on the maintainer's own server.
- Not allowed: paid tiers, trials that turn paid, per-seat tooling, or proprietary SaaS in the
  runtime path (error tracking, analytics, email APIs, maps, fonts CDNs).
- Docker Desktop is not required. Docs and scripts work with Docker Engine or Podman.
- Anything the app talks to at runtime must be optional and self-hostable, or a plain protocol
  (e.g. SMTP to any provider the operator chooses).

## Consequences

### Positive
- Anyone can run it for free; improvements to hosted forks come back to the community.
- Licence problems are caught automatically before they are merged.

### Negative / trade-offs
- AGPL discourages some companies from contributing or embedding it (acceptable for this audience).
- A few useful packages (GPL-2.0-only, source-available licences) are off limits.
- Operators of modified versions must publish their source. This needs to be documented clearly.
