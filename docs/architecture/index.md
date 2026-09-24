# Architecture

For contributors and anyone who wants to understand how RestAssured works.

- [System specification](/SYSTEM_SPEC): data model, permissions, theming, GDPR anonymization,
  forecasting formulas
- [Architecture decision records](/architecture/decisions/): why things are the way they are

## In short

- **SvelteKit + TypeScript + PostgreSQL**, one Node process, server-rendered with progressive
  enhancement.
- **Multi-tenant** with PostgreSQL row-level security: every club's data is isolated at the
  database level.
- **Lightweight:** small bundles, no paid services, everything self-hostable.
