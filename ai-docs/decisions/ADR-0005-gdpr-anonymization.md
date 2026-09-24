# ADR-0005: GDPR Right-to-Be-Forgotten Anonymization Engine for Historical Asset Logs

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, GDPR/Security agent
- **Related:** ADR-0001, ADR-0003, ADR-0007

## Context

Clubs are data controllers for their members' personal data (AVG/GDPR); RestAssured is a
processor. Members leave, and may request erasure (Art. 17). Yet clubs legitimately need to know
that *"tuba #TB-014 was lent out from 2019 to 2023 and returned with a dent"* — the asset history
is club property and is needed for maintenance, insurance claims, and forecasting.

We must erase the **person** without erasing the **history**.

## Decision

### 1. PII inventory is explicit

- Every column containing personal data is annotated in the schema module (`pii: true`, with a
  category: `identity`, `contact`, `free_text`). CI fails if a new column on a PII-bearing table
  lacks an annotation (`pii: false` is an explicit choice).
- PII lives **only** in: `users`, `tenant_memberships`, and explicitly listed free-text columns
  (e.g. `assignments.notes`, `tenant_memberships.notes`). Assignment/audit rows reference people by
  `membership_id` only.

### 2. Two levels of erasure

| Level                 | Trigger                                   | Effect |
|-----------------------|-------------------------------------------|--------|
| **Tenant anonymization** | Holder of `members:anonymize` in tenant T | Scrubs the `tenant_memberships` row in T; revokes the membership. Global `users` row untouched if other memberships remain. |
| **Account erasure**   | User self-service, or Super Admin on verified request | Performs tenant anonymization in **every** tenant, then scrubs the `users` row, sessions, and tokens. |

### 3. What "anonymized" means

- The membership row is kept (so foreign keys and history stay intact), with:
  - `display_name`, `email`, `phone`, `address`, `birth_date`, `member_number`, `notes` → `NULL`
  - `anonymized_at = now()`, `status = 'anonymized'`, `user_id = NULL`
  - `pseudonym_id` = the first 8 hex chars of a **fresh random UUID** (never derived from any PII;
    hashing an email is pseudonymisation, not anonymisation, and is reversible by dictionary).
- The label *"Anonymized Member #3f9a1c20"* / *"Geanonimiseerd lid #3f9a1c20"* is **rendered** from
  an i18n key + `pseudonym_id`; it is not stored as a string (ADR-0007).
- Free-text columns referencing the member are nulled, or replaced with the i18n marker
  `[redacted]`, because free text cannot be reliably scrubbed.
- Audit log entries keep `actor_membership_id` / `subject_membership_id` (now anonymous) and
  never contained raw PII in the first place (audit payloads store IDs and field *names*, not
  values, for PII columns).

### 4. Execution

- Engine runs as one DB transaction per tenant: preview (dry-run report of affected rows) →
  explicit confirmation → execute → verify (re-query asserts zero PII columns non-null) → audit.
- Guards: cannot anonymize the last active Tenant Admin; members with open assignments show a
  warning (asset still out) but anonymization may proceed — the open assignment remains, linked
  to the anonymous member, and is flagged for follow-up.
- Idempotent: re-running on an anonymized membership is a no-op.
- An `erasure_log` (tenant-scoped) records `membership_id`, `executed_at`, `executed_by`,
  `level` — no PII — so erasures can be **replayed** after a backup restore.

### 5. Backups & retention

- Backups older than the retention window (default 35 days) are destroyed. On restore, the
  `erasure_log` is replayed before the system is reopened.
- Inactive memberships are surfaced to admins after a configurable period (default 24 months)
  as candidates for anonymization (data minimisation), but never auto-anonymized without admin
  confirmation.

## Consequences

### Positive
- Asset history, depreciation, and assignment statistics remain intact.
- Erasure is verifiable, auditable, and restore-safe.
- Forcing PII annotation makes future schema changes GDPR-aware by default.

### Negative / trade-offs
- Anonymization is irreversible; misclicks are costly → preview + typed confirmation required.
- Small clubs: an anonymous member plus dates may still be re-identifiable by insiders
  ("who had the tuba in 2021?"). This is residual risk; document it in the club's privacy notice.
- Fiscal retention obligations (NL: 7 years for financial records) may apply to deposits or
  rental fees if those are ever added; such records need a separate ADR.

### Follow-ups
- Test: after anonymization, a full-text search of the DB dump for the original name/email
  returns no hits in tenant tables.
- Right of access (Art. 15): `members:export_data` produces a JSON export of one member's data.
