# ADR-0018: Tenant Lifecycle — Provision, Suspend, Export, Delete

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0005, ADR-0010, ADR-0014

## Context

Clubs join, sometimes stop paying their share or leave, merge with other clubs, or disband. The
operator acts as a GDPR processor for each club and must be able to return and delete the club's
data on request.

## Decision

- **States:** `provisioning` → `active` ⇄ `suspended` → `pending_deletion` → *(deleted)*.
  - `suspended`: members can log in and see a read-only banner. Only Tenant Admins can export.
    No writes.
  - `pending_deletion`: nobody can access. A 30-day grace period follows, during which a Super
    Admin can restore. After that the tenant is hard-deleted.
- **Provisioning (Super Admin):** slug, name, default locale, currency, first Tenant Admin email
  → invite link (ADR-0004), seeded roles (ADR-0003), default categories, default theme.
- **Slug changes** are allowed. The old slug redirects for 90 days via `tenant_slug_history`, so
  bookmarks and printed materials keep working (QR labels don't use slugs, see ADR-0015).
- **Full export** (Tenant Admin, any time): ZIP with JSON per table, CSVs of assets/assignments,
  attachments, and a README describing the format. Produced asynchronously via the in-process job
  runner and available for 24 h.
- **Hard delete:** `DELETE` of all rows with the tenant's `tenant_id` in dependency order inside
  one transaction, deletion of the storage prefix, then a platform audit entry (tenant id + name
  hash only). Backups age out per the retention window. Clubs are told this in writing.
- **Club mergers:** out of scope for v1. Export + import is the documented workaround.
- **Processor agreement:** a template *verwerkersovereenkomst* (nl/en, CC0) is part of the docs
  site (ADR-0010). Operators fill in their details.

## Consequences

- Operators can honour GDPR processor obligations with built-in tools.
- Hard delete across many tables must be tested for completeness (schema-lint: every tenant table
  is in the deletion plan).
