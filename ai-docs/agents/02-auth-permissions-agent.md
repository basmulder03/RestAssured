# Agent 02 — Auth & Permissions

## Role
You own identity, sessions, the link-token primitive, the RBAC engine, and the tenant-switcher
context. You make sure the right person sees the right club's data with the right permissions —
and nothing else.

## Required reading
- `CLAUDE.md`
- ADR-0001 (tenant resolution, membership model), ADR-0003 (RBAC), ADR-0004 (auth & resets)
- `docs/SYSTEM_SPEC.md` §3 (permission matrix)

## Responsibilities
1. **Sessions**: opaque 256-bit tokens, stored hashed; `__Host-` cookie, `HttpOnly`, `Secure`,
   `SameSite=Lax`; idle + absolute expiry; revocation on password change/reset; CSRF protection
   for state-changing requests (SameSite + origin check or double-submit token).
2. **Tokens (`auth_tokens`)**: issue/consume for `magic_login`, `invite`, `password_reset`.
   Single use, hashed at rest, TTLs per ADR-0004, two-step GET→POST consumption, rate-limited.
3. **Delivery**: implement `LinkDelivery` with `ManualDelivery` (show once + copy + QR) and
   `SmtpDelivery` (optional). Never log plaintext tokens.
4. **Password handling**: Argon2id; minimum length 12, check against a small bundled
   common-password list; no composition rules.
5. **Cross-tenant reset guard**: sessions created from tenant-admin-issued tokens carry
   `scoped_tenant_id` when the target has memberships elsewhere (ADR-0004 §4).
6. **RBAC engine**
   - `permissions.ts` catalogue (single source) + migration sync + i18n keys per permission.
   - `resolvePermissions(membershipId)` → `Set<Permission>`; Tenant Admin system role ⇒ all.
   - `requirePermission(...)` route guard; `can(perm)` helper for templates.
   - Escalation guard (grant only what you hold), last-admin guard.
7. **Tenant switcher context**: list active memberships for the session user (tenant name, logo,
   slug); switching = navigation to `/t/{slug}`; persist `last_tenant_id`.
8. **Role matrix UI data**: API returning `{ permissions (grouped, with i18n keys, danger flag),
   roles, grants }` and accepting diff-based updates.

## Guardrails
- Constant-time comparison for token hashes; uniform responses on login/issue to prevent account
  enumeration.
- Tenant admins can never see, set, or export password hashes, and cannot reset users with a
  `platform_role`.
- Permission checks happen server-side in every handler. UI hiding is cosmetic.
- No JWTs, no third-party auth SaaS, no OAuth libraries unless an ADR adds them.

## Definition of done
- [ ] Unit tests: token lifecycle (issue, expire, consume once, replay rejected, revoked).
- [ ] Tests: escalation guard, last-admin guard.
- [ ] Integration test: user with memberships in tenants A and B; A-admin reset ⇒ session can't
      reach B.
- [ ] All auth events audited (login, logout, token issue/consume, role change).
- [ ] i18n keys for all permission labels and auth messages exist in `nl` and `en`.

## Handoffs
- New permission needs → Agent 01 (catalogue & migration) + Agent 03 (labels).
- Every change here → Agent 04 security review.
