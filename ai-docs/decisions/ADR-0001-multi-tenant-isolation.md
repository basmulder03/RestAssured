# ADR-0001: Multi-Tenant Data Isolation & Cross-Tenant User Membership Strategy

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, Architect agent
- **Related:** ADR-0003, ADR-0004, ADR-0005

## Context

RestAssured hosts many independent clubs (tenants) on one deployment. Clubs are non-profits with
small budgets, so we cannot afford a database (or even a schema) per tenant operationally:
migrations, backups, and connection pooling would scale linearly with tenant count.

At the same time, a leak of one club's member list or insured-value data to another club is the
single most damaging failure this product can have. Isolation must therefore not depend solely on
developers remembering a `WHERE tenant_id = ?` clause.

Two further forces:

1. **One person, many clubs.** A musician may play in a harmonie and a marching band. They must
   have one login and switch between clubs.
2. **Most members never log in.** Only the people who manage inventory (board members,
   quartermasters, instrument managers) get an account. Everyone else, including children and
   aspirant members, is just a reference, so the club can see who has what and where it is.
   Assignments must reference a person, not a user account.

## Decision

### 1. Shared database, shared schema, PostgreSQL Row-Level Security (RLS)

- Every tenant-owned table has a non-null `tenant_id uuid` column, and it is the leading column of
  the primary key or of a composite unique index (e.g. `(tenant_id, id)`).
- RLS is `ENABLE`d **and** `FORCE`d on every tenant-owned table with the policy:
  ```sql
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
  ```
- The application connects as role `ra_app`, which is **not** a superuser, does **not** own the
  tables, and does **not** have `BYPASSRLS`. Migrations run as a separate owner role `ra_owner`.
- Every request that touches tenant data runs inside a transaction that begins with
  `SELECT set_config('app.tenant_id', $1, true)` (transaction-local, so pooled connections cannot
  leak context). A missing setting yields `NULL` → zero rows, i.e. fail closed.
- Foreign keys between tenant tables are **composite** (`(tenant_id, asset_id)` →
  `assets(tenant_id, id)`) so a row can never reference another tenant's row, even by bug.
- Application code **also** filters by `tenant_id` (defence in depth). RLS is the safety net, not
  the only mechanism.

### 2. Global identity, tenant-scoped membership

| Table                | Scope   | Purpose                                                             |
|----------------------|---------|---------------------------------------------------------------------|
| `users`              | Global  | Login identity: email, password hash, locale preference.            |
| `tenants`            | Global  | Club registry: slug, name, status, default locale.                  |
| `tenant_memberships` | Tenant  | A *person in a club*. `user_id` is **nullable** and `NULL` for most rows: members are references by default. Holds tenant-scoped PII (display name; contact details and member number optional). |
| `membership_roles`   | Tenant  | Membership ↔ role assignment.                                       |

- `users` is **not** protected by tenant RLS; it is only reachable via a narrow repository that
  never exposes it to tenant-scoped queries except through a membership join.
- A tenant can see a user's email only via its own membership row (copied/linked at invite time).
  It can never enumerate `users`.
- Unique constraint: `UNIQUE (tenant_id, user_id) WHERE user_id IS NOT NULL`.
- **Accounts are the exception.** A membership gets a `user_id` only when an admin invites that
  person to manage inventory (ADR-0004 §5). The invite links the account to the *existing*
  membership row, so the person's assignment history stays in one place.
- Reference members need only a display name. All other personal fields are optional, and the UI
  encourages leaving them empty (data minimisation, ADR-0005).

### 3. Tenant resolution: URL, not session

- Tenant context comes from the URL path: `/t/{tenantSlug}/...`. The session is global
  (identifies the user only).
- On every request, middleware resolves `slug → tenant_id`, verifies an **active** membership for
  the session user in that tenant, loads effective permissions, and only then sets
  `app.tenant_id`. No membership → `404` (not `403`, to avoid tenant enumeration).
- The tenant switcher is therefore just navigation; multiple tabs on different clubs work.
- The last-used tenant is remembered on `users.last_tenant_id` purely for redirect convenience.

### 4. Platform (Super Admin) scope

- Platform tables (`tenants`, `platform_settings`, `users` administration) live outside tenant RLS
  and are served under `/platform/...` with a separate middleware chain.
- A platform admin has **no implicit access** to tenant data. Support access requires an explicit,
  time-boxed, audited "support session" that sets `app.tenant_id` like a normal member and is
  visible to the tenant's admins in their audit log.

## Consequences

### Positive
- One schema, one migration path, one backup — cheap to operate.
- Cross-tenant leakage requires both an application bug *and* a DB policy bug.
- Composite FKs make cross-tenant references structurally impossible.
- Members without accounts (the majority) are first-class.

### Negative / trade-offs
- Ties us to PostgreSQL (≥ 16, see ADR-0008). SQLite is not an option for production.
- Every query path must run inside a transaction with the tenant setting — requires a
  well-tested DB helper (`withTenant(tenantId, fn)`) and discipline around connection pooling.
- RLS can hide performance problems; `tenant_id` must lead relevant indexes.
- Heavy per-tenant analytics across all tenants (platform stats) need a dedicated, audited
  `ra_platform_reporting` role with read-only `BYPASSRLS` on aggregate views only.

### Follow-ups
- Automated test: for every tenant table, assert RLS is enabled + forced (schema lint in CI).
- Automated test: cross-tenant read/write attempts return zero rows / fail.
