# ADR-0004: Lightweight Magic-Link Authentication & Tenant-Admin-Mediated Password Reset Flow

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, Auth/Permissions agent, GDPR/Security agent
- **Related:** ADR-0001, ADR-0003

## Context

- Clubs are run by volunteers; we must not require them to configure a transactional email
  provider before they can start.
- Members should not need to remember yet another password if they don't want to.
- When someone is locked out, the practical support channel is the club's own admin, not a
  platform helpdesk.
- A single user account spans multiple tenants (ADR-0001), so an action by one club's admin can
  affect a person's access to another club. This is the central security tension of this ADR.

## Decision

### 1. Credentials

- Two login methods on a global `users` account:
  1. **Magic link** (primary).
  2. **Password** (optional; hashed with Argon2id, params m=19 MiB, t=2, p=1 minimum).
- Sessions: opaque random 256-bit tokens, stored **hashed** (SHA-256) in `sessions`, delivered
  in a `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Idle timeout 14 days,
  absolute 60 days. No JWTs.

### 2. One token primitive for all links

A single `auth_tokens` table backs invites, magic links, and resets:

| Column         | Notes                                                       |
|----------------|-------------------------------------------------------------|
| `token_hash`   | SHA-256 of a 256-bit random value; plaintext never stored   |
| `purpose`      | `magic_login` \| `invite` \| `password_reset`               |
| `user_id` / `membership_id` | target                                         |
| `issued_by`    | user id (NULL for self-service)                             |
| `issued_in_tenant_id` | tenant context of the issuer (NULL for self-service) |
| `expires_at`   | magic_login 15 min · invite 7 days · password_reset 24 h    |
| `consumed_at`  | single use; set atomically on consumption                   |

- Consumption is a two-step flow: `GET /auth/link/{token}` renders a confirmation page with a
  button (`POST`), so link-preview bots and email scanners cannot burn the token.
- Rate limits: per email and per IP on issue; constant-time responses that never reveal whether
  an email exists.

### 3. Delivery channels (pluggable)

`LinkDelivery` interface with two implementations shipped initially:

1. **Manual (default, zero-config):** the link is shown **once** to the issuing admin with a
   copy button and QR code, to hand over in person or via the club's own chat. Used for invites
   and admin-issued resets.
2. **SMTP (optional):** plain SMTP settings at platform level (or per tenant later). When
   configured, self-service magic login is enabled. When not configured, the login page offers
   password login and "ask your club admin for a login link".

No third-party email SaaS SDK is a dependency.

### 4. Tenant-admin-mediated password reset

- Holders of `members:reset_password` can issue a `password_reset` (or `magic_login`) token for a
  membership in their tenant. The admin **never sets or sees a password**.
- On consumption: the user sets a new password (or just logs in), **all existing sessions for that
  user are revoked**, and the event is audited in the issuing tenant.
- **Cross-tenant guard:** if the target user has active memberships in *other* tenants where the
  issuer is not a Tenant Admin, the resulting session is **scoped to the issuing tenant**. Access
  to the other tenants is restored only after the user proves control of their account through a
  channel the issuing admin does not control (self-service magic link to the verified email, or
  an admin of each other tenant re-issuing). This prevents a club admin from taking over a
  person's account in another club.
- Users with a `platform_role` cannot be reset by tenant admins at all.

### 5. Sign-up

- Accounts are only for people who manage inventory. Reference members (the majority, ADR-0001)
  never receive links and never log in.
- No open self-registration into tenants. People join a tenant only via an `invite` token issued
  by a member with `members:invite`, or via tenant provisioning by a Super Admin (first admin).
- Inviting an existing reference member attaches the account to that membership row. It never
  creates a second person.
- If the invite email matches an existing `users` row, consuming the invite *links* the
  membership after the user authenticates as that account; it never merges silently.

## Consequences

### Positive
- A club can go live with zero infrastructure beyond the app itself.
- One token mechanism, one set of tests, one audit trail.
- The cross-tenant guard closes the obvious account-takeover path inherent in admin resets.

### Negative / trade-offs
- Manual link hand-over relies on admins sharing links over reasonably private channels; links
  are bearer credentials. Short TTLs and single use limit the blast radius.
- Without SMTP, email addresses are unverified; the cross-tenant guard then falls back to
  per-tenant admin re-issue, which is more friction for multi-club members.
- No MFA initially (see recommendations).

### Follow-ups
- Test: every token purpose is single-use, expires, and cannot be replayed after revocation.
- Test: cross-tenant scoped session cannot reach `/t/{otherSlug}`.
