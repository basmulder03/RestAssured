# ADR-0019: Rental Fees, Deposits & Fiscal Retention (Deferred)

- **Status:** Proposed — deferred until a club needs it
- **Date:** 2026-09-24
- **Related:** ADR-0005, ADR-0006

## Context

Some clubs charge members a yearly instrument rental fee (*huurvergoeding*) or a deposit
(*borg*). Once money is tracked against a person, Dutch fiscal retention rules (7 years for
financial records, *fiscale bewaarplicht*) can conflict with the right to erasure. Most clubs
handle this in their bookkeeping software, not in an asset tool.

## Decision (proposed)

- **v1 does not record payments.** An assignment may have an informational
  `rental_fee_cents_per_year` and `deposit_cents` (club policy, not bookkeeping). These are
  asset/assignment attributes without payment status.
- If payment tracking is added later, it goes in a separate `financial_records` table with its
  own retention class. On anonymization the member reference is replaced by the pseudonym, and the
  amounts, dates, and a bookkeeping reference are kept for 7 years as permitted by GDPR
  Art. 17(3)(b). The privacy notice template must mention this.
- Export of fee overviews to CSV for the club's bookkeeping software is the preferred
  integration.

## Consequences

- v1 has no collision between erasure and fiscal retention.
- Clubs keep using their existing bookkeeping for actual money.
