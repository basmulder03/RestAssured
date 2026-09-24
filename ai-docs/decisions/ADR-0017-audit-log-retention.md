# ADR-0017: Audit Log Scope, Access & Retention

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0003, ADR-0005

## Context

The audit log (ADR-0005) records who changed what. It is needed to resolve disputes ("who
checked out the sousaphone?") and for security investigations, but unbounded retention contradicts
data minimisation, and the log itself identifies members through their membership IDs.

## Decision

- **Scope:** all state-changing actions in a tenant (assets, assignments, maintenance, members,
  roles, settings, theme, imports, token issuance, anonymization) and all platform actions
  (tenant provisioning, support sessions). Reads are not logged, except support-session reads
  and data exports.
- **Content:** action, actor, subject, timestamp, request id, and changed field **names**. Old and
  new values are stored only for non-PII fields (e.g. `purchase_price_cents`, `status`).
- **Access:** tenant audit via `audit:view`. Platform audit is visible to Super Admins only.
  Support sessions appear in the tenant's audit view (ADR-0001 §4).
- **Retention:** default 3 years for tenant audit entries, configurable by the tenant between
  1 and 7 years. Security events (login failures, token issuance) are kept 1 year. A nightly
  housekeeping job deletes expired entries via a `SECURITY DEFINER` function, which is the only
  delete path. `ra_app` still has no DELETE grant.
- **Asset history is not audit:** assignments and maintenance events are domain data with their
  own lifecycle (kept for the asset's lifetime, anonymized per ADR-0005). They are not subject to
  audit retention.

## Consequences

- There's a clear answer for clubs' privacy notices ("audit data kept 3 years").
- Deleting through a function keeps the append-only guarantee for normal application paths.
