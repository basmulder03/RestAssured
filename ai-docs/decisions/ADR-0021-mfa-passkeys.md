# ADR-0021: Passkeys & Two-Factor Authentication for Privileged Accounts

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0003, ADR-0004, ADR-0009

## Context

Magic links and passwords (ADR-0004) are single-factor. Super Admins can provision and delete
tenants. Tenant Admins can issue login links and anonymize members. A compromised privileged
account is high impact, and links shared in chat apps widen the exposure.

## Decision

- **Passkeys (WebAuthn)** as the preferred second factor and optional passwordless login, using
  `@simplewebauthn/server` and `@simplewebauthn/browser` (MIT).
- **TOTP** fallback using `otpauth` (MIT). Secrets are encrypted at rest with a key from
  `RA_SECRET_KEY`. There are 10 single-use recovery codes, stored hashed.
- **Enforcement:**
  - Super Admin: a second factor is required. The platform panel is inaccessible without it.
  - Tenant Admin (and any role holding a ⚠ dangerous permission): tenant setting
    `require_2fa_for_admins`, default **on** for new tenants.
  - Step-up re-authentication (≤ 10 minutes old) before dangerous actions: anonymization, issuing
    reset links, role matrix changes, tenant deletion.
- **Recovery:** a Tenant Admin can't reset another user's second factor for accounts that are
  members of other tenants (same cross-tenant guard as ADR-0004 §4). A Super Admin can, after
  out-of-band verification, and it is audited.
- No SMS (costs money, and weak).

## Consequences

- Much stronger protection for the accounts that matter most, at zero cost.
- More support burden for lost devices. Recovery codes plus Tenant Admin / Super Admin paths
  cover it.
