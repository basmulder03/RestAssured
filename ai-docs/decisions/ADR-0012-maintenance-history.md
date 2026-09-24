# ADR-0012: Asset Maintenance & Repair History

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0005, ADR-0006, ADR-0016

## Context

Clubs send instruments for servicing (cleaning, re-padding, dent removal) and need to know when an
asset was last serviced, by whom, at what cost, and whether it's currently away. The forecasting
engine (ADR-0006) uses assumed maintenance percentages. Real costs would make it more accurate.

## Decision

- New tenant table `maintenance_events`: `asset_id`, `kind` (`service` | `repair` | `inspection` |
  `cleaning` | `other`), `status` (`planned` | `in_progress` | `done` | `cancelled`),
  `vendor_name` (a business, not PII), `started_on`, `completed_on`, `cost_cents`,
  `description` (free text, PII-annotated), `reported_by_membership_id`, `attachment_ids`
  (ADR-0016).
- While an event is `in_progress`, the asset's status becomes `in_repair` automatically. Starting
  a repair doesn't close an open assignment unless the user chooses to.
- Damage reported by a member (in person or by message) is recorded by someone with
  `maintenance:manage` on the member's behalf as a `planned` event, linked to the open assignment.
  Members themselves don't log in (ADR-0001).
- New permission `maintenance:manage`. Reading requires `assets:view`. Viewing `cost_cents`
  requires `assets:view_financials`.
- Forecasting: when a tenant has ≥ 3 years of completed events for a category, the forecast screen
  shows the *observed* maintenance rate next to the configured one and offers to adopt it. It is
  never applied automatically.
- Due reminders: optional `service_interval_months` on the category or asset. The dashboard lists
  assets overdue for service.

## Consequences

- The per-asset timeline becomes: purchase → assignments → maintenance → retirement.
- Vendor names are treated as business data, not PII. If a vendor is a sole trader, admins are
  asked (UI hint) not to enter personal details.
