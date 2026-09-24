# ADR-0022: Quantity-Tracked Items & Asset Sets

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0006, ADR-0013, ADR-0014

## Context

Not everything is a uniquely identifiable asset. Clubs own "40 caps size M", "25 music stands",
"a box of lyres (marching music holders)". A drum kit is several pieces sharing one purchase and
sometimes one serial. Forcing one row per item makes data entry painful and imports messy.

## Decision

- `assets.tracking` = `individual` (default, one physical item) | `quantity` (a stock line).
- **Quantity assets** have `quantity_total`. Assignments of quantity assets carry `quantity`
  (≥ 1). The partial unique index "one open assignment per asset" applies only to `individual`
  assets. For `quantity` assets, a check ensures the sum of open assignment quantities
  ≤ `quantity_total` (enforced in a transaction with `SELECT … FOR UPDATE` on the asset row).
- Forecasting: purchase price and insured value are **per unit** for quantity assets and are
  multiplied by `quantity_total`. Partial replacement isn't modelled in v1.
- **Sets:** `assets.parent_asset_id` (nullable, same tenant) groups components (drum kit →
  snare, toms, cymbals). Checking out the parent checks out all components that aren't
  individually assigned. Each component keeps its own serial/value when known.
- Import (ADR-0014) maps an "Aantal/Quantity" column to `quantity` tracking.

## Consequences

- Clothing and accessories become practical to manage. Uniform sizes use custom fields
  (ADR-0013), one stock line per size.
- The assignment and forecast logic gains one branch each, covered by table-driven tests.
