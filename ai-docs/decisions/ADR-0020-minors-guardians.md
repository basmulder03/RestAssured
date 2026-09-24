# ADR-0020: Minors & Guardian Contacts

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0004, ADR-0005

## Context

Youth orchestras and *opleidingsorkesten* lend instruments to children. In the Netherlands,
consent for information society services is required from parents for children under 16
(UAVG art. 5). Clubs need a responsible adult to contact about an instrument held by a child.

## Decision

- Like most members, minors are reference records without an account (ADR-0001). Minors under 16
  can never be invited to get an account.
- Membership gets an optional `is_minor boolean` (no birth date stored, per data minimisation;
  admins toggle it and it clears automatically on a set review date).
- `guardian_links` (tenant table): `minor_membership_id` → `guardian_membership_id`
  (the guardian is also a reference membership and may be in the club only as a guardian).
  Guardians are contacts, not users.
- Assignment to a minor requires a guardian link. The checkout screen shows the guardian's contact
  details to users with `members:view`.
- Anonymizing a minor doesn't anonymize the guardian, and vice versa. Anonymizing a guardian with
  linked minors who still hold assets shows a blocker warning.

## Consequences

- Children never have accounts, and the club always has a responsible adult to contact.
- It adds one relation (`guardian_links`).
