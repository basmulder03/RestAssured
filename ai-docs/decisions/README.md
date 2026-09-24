# Architectural Decision Records (ADRs)

This directory is the **single source of truth** for architectural decisions in RestAssured.
Every agent (human or AI) must read the relevant ADRs **before** proposing or implementing a
change that touches data model, tenancy, auth, theming, i18n, GDPR, or forecasting.

## When to write an ADR

Write an ADR when a change:

- Alters the data model in a way that affects tenancy, PII, or financial calculations.
- Introduces a new dependency heavier than a small utility (see "Lightweight budget" in `CLAUDE.md`).
- Changes an auth, session, permission, or isolation mechanism.
- Changes a public API contract, URL scheme, or localisation key structure.
- Reverses or materially amends an existing ADR.

Bug fixes, refactors inside a module, and UI tweaks do **not** need an ADR.

## File naming

```
ADR-NNNN-short-kebab-title.md
```

`NNNN` is a zero-padded, monotonically increasing number. Numbers are never reused, even if an
ADR is rejected.

## Template

```markdown
# ADR-NNNN: <Title>

- **Status:** Proposed | Active | Superseded by ADR-XXXX | Deprecated | Rejected
- **Date:** YYYY-MM-DD
- **Deciders:** <names/roles>
- **Related:** ADR-XXXX, ADR-YYYY

## Context
What problem are we solving? Which forces (requirements, constraints, risks) are in play?

## Decision
What we decided, stated in active voice ("We will…"). Include the concrete rules agents must follow.

## Consequences
### Positive
### Negative / trade-offs
### Follow-ups
```

## Lifecycle

| Status       | Meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| Proposed     | Under discussion. Must not be implemented beyond spikes.                |
| Active       | Binding. Code must conform; deviations require a new ADR.               |
| Superseded   | Replaced by a newer ADR (link it). Kept for history — never delete.    |
| Deprecated   | No longer relevant, not replaced.                                       |
| Rejected     | Considered and declined. Kept so the discussion is not repeated.        |

Active ADRs are **immutable in substance**. Typos and clarifications are fine; a change in
decision requires a new ADR that supersedes the old one, and the old one's status is updated.

## Protocol for AI agents

1. Before designing: `grep -ril "<topic>" ai-docs/decisions/` and read every Active match.
2. If your proposal conflicts with an Active ADR, **stop** and surface the conflict instead of
   working around it. Propose a superseding ADR with status `Proposed`.
3. Never mark your own ADR `Active`; a human maintainer promotes it.
4. Reference ADR numbers in commit messages and PR descriptions when implementing them
   (e.g. `feat(auth): magic-link consumption endpoint (ADR-0004)`).

## Index

| #    | Title                                                                  | Status |
|------|------------------------------------------------------------------------|--------|
| 0001 | [Multi-Tenant Data Isolation & Cross-Tenant User Membership](ADR-0001-multi-tenant-isolation.md) | Active |
| 0002 | [Dynamic CSS Variable-Based Tenant Theming](ADR-0002-tenant-theming.md) | Active |
| 0003 | [Hierarchical Admin & Fine-Grained RBAC Permission Matrix](ADR-0003-rbac-permission-matrix.md) | Active |
| 0004 | [Magic-Link Authentication & Tenant-Admin-Mediated Password Reset](ADR-0004-magic-link-auth.md) | Active |
| 0005 | [GDPR Right-to-Be-Forgotten Anonymization Engine](ADR-0005-gdpr-anonymization.md) | Active |
| 0006 | [Predictive Cost Analytics & Depreciation Model](ADR-0006-cost-forecasting.md) | Active |
| 0007 | [Internationalization (nl/en) Strategy](ADR-0007-i18n.md) | Active |
| 0008 | [Technology Stack](ADR-0008-tech-stack.md) | Active |
| 0009 | [Project Licence, Dependency Licence Policy & Zero-Cost Tooling](ADR-0009-licensing-dependency-policy.md) | Active |
| 0010 | [Documentation Strategy & Self-Hosting Model](ADR-0010-documentation-self-hosting.md) | Active |
| 0011 | [CI, Source Hosting & Release Process](ADR-0011-ci-release-process.md) | Active |
| 0012 | [Asset Maintenance & Repair History](ADR-0012-maintenance-history.md) | Proposed |
| 0013 | [Tenant-Defined Custom Fields](ADR-0013-custom-fields.md) | Proposed |
| 0014 | [Spreadsheet Import & Export](ADR-0014-spreadsheet-import-export.md) | Proposed |
| 0015 | [Offline-Capable Mobile Checkout & Asset Labels](ADR-0015-offline-mobile-checkout.md) | Proposed |
| 0016 | [File Attachments & Photos](ADR-0016-file-attachments.md) | Proposed |
| 0017 | [Audit Log Scope, Access & Retention](ADR-0017-audit-log-retention.md) | Proposed |
| 0018 | [Tenant Lifecycle — Provision, Suspend, Export, Delete](ADR-0018-tenant-lifecycle.md) | Proposed |
| 0019 | [Rental Fees, Deposits & Fiscal Retention (Deferred)](ADR-0019-rentals-deposits.md) | Proposed |
| 0020 | [Minors & Guardian Contacts](ADR-0020-minors-guardians.md) | Proposed |
| 0021 | [Passkeys & Two-Factor Authentication for Privileged Accounts](ADR-0021-mfa-passkeys.md) | Proposed |
| 0022 | [Quantity-Tracked Items & Asset Sets](ADR-0022-quantity-tracked-assets.md) | Proposed |
