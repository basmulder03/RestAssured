# ADR-0003: Hierarchical Admin Configuration & Fine-Grained RBAC Permission Matrix

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, Auth/Permissions agent
- **Related:** ADR-0001, ADR-0004, ADR-0005

## Context

Every club organises itself differently. One club's "Materiaalbeheerder" edits assets and handles
checkouts; another splits that between an instrument manager and a uniform coordinator. Financial
data (purchase prices, insured values, forecasts) is sensitive and usually restricted to the
board. We need:

- A platform level (Super Admin) and a club level (Tenant Admin) with clearly separated powers.
- Custom, club-defined roles built from a fixed catalogue of granular permissions.
- A UI matrix that non-technical board members can understand.

## Decision

### 1. Two scopes, two separate models

| Scope    | Who                     | Mechanism                                                   |
|----------|-------------------------|-------------------------------------------------------------|
| Platform | Super Admin             | `users.platform_role IN ('super_admin','support')`. Separate `/platform` routes. Step-up re-auth for destructive actions. |
| Tenant   | Everyone else           | Tenant-defined roles → permissions from a code-defined catalogue. |

Platform roles do **not** grant tenant permissions (see ADR-0001 §4).

### 2. Permission catalogue is code, roles are data

- Permissions are string constants of the form `resource:action` (optionally
  `resource:action_scope`), defined in one module (`permissions.ts`) and synced into the
  `permissions` table by migration. Tenants cannot invent permissions.
- Each permission has i18n keys for label and description (`perm.assets.edit.label`).
- Initial catalogue:

  | Group        | Permissions |
  |--------------|-------------|
  | Assets       | `assets:view`, `assets:create`, `assets:edit`, `assets:delete`, `assets:view_financials` |
  | Assignments  | `assignments:view`, `assignments:manage` |
  | Members      | `members:view`, `members:manage`, `members:invite`, `members:reset_password`, `members:anonymize`, `members:export_data` |
  | Roles        | `roles:view`, `roles:manage` |
  | Financials   | `financials:read_forecasts`, `financials:configure_forecasts` |
  | Tenant       | `tenant:manage_settings`, `tenant:manage_theme` |
  | Audit/Data   | `audit:view`, `data:import`, `data:export` |

- `assets:view_financials` gates the purchase price / insured value **columns**, not just pages;
  serializers strip these fields when absent.

### 3. Roles

- `roles` are tenant-scoped rows. Each tenant is provisioned with:
  - **Tenant Admin** (`is_system = true`): implicitly holds all tenant permissions, cannot be
    edited or deleted.
  - Editable templates: *Bestuurslid / Board Member*, *Materiaalbeheerder / Quartermaster*,
    *Instrumentbeheerder / Instrument Manager*, *Meekijker / Viewer* (read-only).
- Roles apply only to memberships with a user account. Most members are references without an
  account (ADR-0001) and have no roles.
- A membership may hold multiple roles; effective permissions = union. No deny rules (keeps the
  matrix understandable).
- Template role names are stored as i18n keys until a tenant renames them; renamed roles store
  per-locale names `{ "nl": "...", "en": "..." }` (ADR-0007).

### 4. Guardrails

- **No escalation:** a user may only grant permissions they themselves hold, and only
  a Tenant Admin may assign the Tenant Admin role.
- **No lockout:** the last active Tenant Admin cannot be removed, demoted, or anonymized.
- **Server-side enforcement only:** every handler declares its required permission
  (`requirePermission('assets:edit')`). The UI hides controls as a convenience, never as security.
- **Row-level ownership:** if a future `*_own` permission is added, it is enforced by query
  predicate (`membership_id = currentMembershipId`), not by post-filtering.
- Permission changes take effect on the next request (permissions resolved per request, cached
  in-request only, or with a version-stamped short cache invalidated on role change).
- All role/permission changes are written to the audit log.

### 5. UI matrix

- Rows = permissions grouped by resource; columns = roles; cells = checkboxes.
- System role column rendered read-only (all checked).
- Dangerous permissions (`members:anonymize`, `roles:manage`, `members:reset_password`) are
  visually flagged and require confirmation to grant.

## Consequences

### Positive
- Clubs model their own organisation without code changes.
- Code stays the source of truth for what a permission *means*.
- Union-only semantics are easy to explain and to test.

### Negative / trade-offs
- No deny rules or attribute-based conditions (e.g. "only uniforms"). Category-scoped
  permissions would need a follow-up ADR.
- Adding a permission requires a deploy and a decision on which template roles receive it.

### Follow-ups
- Property test: no role mutation path can produce a tenant with zero active admins.
- Contract test: every route has a declared permission (lint/route table check).
