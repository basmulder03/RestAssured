# ADR-0006: Predictive Cost Analytics & Insurance Depreciation Model Engine

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, Forecasting Engine agent
- **Related:** ADR-0001, ADR-0003

## Context

Club treasurers need to answer: *"How much should we reserve each year so we can replace
instruments and uniforms when they wear out, and are we over- or under-insured?"* Today this lives
in spreadsheets (purchase price, purchase year, insured value) with no forward view.

Requirements: multi-year projections of depreciation, maintenance, and replacement; explainable
numbers a treasurer can defend at a general assembly (ALV); lightweight computation; tolerant of
incomplete spreadsheet data.

## Decision

### 1. Deterministic, explainable models — no ML

- The engine is a set of **pure functions** (`forecast(assets, params, horizon) → ForecastResult`)
  with no I/O. Same inputs → same outputs. No machine-learning, no external services.
- Every projected amount carries a breakdown (which asset, which rule, which parameters) so the UI
  can show "why".

### 2. Money and time

- All amounts are **integer euro-cents** (`bigint`), currency per tenant (default `EUR`).
  Floating point is used only inside rate calculations and results are rounded half-to-even to
  cents at each yearly step.
- Time granularity is the **calendar (or tenant fiscal) year**. Purchase *year* is what the source
  spreadsheets contain; month precision is optional.

### 3. Parameters: category defaults, tenant overrides, asset overrides

Resolution order (first non-null wins): **asset → tenant category setting → platform category
default**.

| Parameter                 | Meaning                                        | Example default (brass) |
|---------------------------|------------------------------------------------|-------------------------|
| `lifespan_years`          | Expected useful life                           | 25                      |
| `residual_pct`            | Value at end of life as % of purchase price   | 10 %                    |
| `depreciation_method`     | `straight_line` \| `declining_balance`         | straight_line           |
| `maintenance_pct_per_year`| Annual maintenance as % of replacement cost    | 2 %                     |
| `major_service_interval`  | Years between major overhauls (optional)       | 8                       |
| `major_service_pct`       | Overhaul cost as % of replacement cost         | 15 %                    |
| `price_inflation_pct`     | Annual price index for replacement cost        | tenant-level, 3 %       |

Formulas are specified in `docs/SYSTEM_SPEC.md §6` and are the contract for the implementation.

### 4. Scope rules

- Only `ownership = 'club'` assets enter budgets. Private assets appear in insurance overviews
  only (clubs sometimes insure members' instruments) and are clearly labelled.
- Assets with status `retired`/`lost`/`sold` are excluded from future years.
- **Missing data:** if `purchase_year` is missing the asset is flagged `incomplete` and excluded
  from depreciation but may use insured value as a replacement-cost proxy; if `purchase_price`
  is missing, insured value is used; if both are missing the asset is listed in a "data quality"
  section and excluded. Totals always state how many assets were excluded.

### 5. Execution

- Forecasts are computed on demand (a club has hundreds, not millions, of assets). Results may
  be cached per tenant keyed by a hash of (asset data version, parameter version, horizon).
- Snapshots: a treasurer can "freeze" a forecast (stored as JSON with parameters) for board
  minutes, so later data changes don't silently alter an approved budget.

## Consequences

### Positive
- Transparent numbers that survive scrutiny at the ALV.
- Trivial to unit test (pure functions, table-driven tests with hand-calculated expectations).
- No heavy analytics stack.

### Negative / trade-offs
- Simple models will be wrong for individual assets; they are useful in aggregate.
- Category defaults must be curated; bad defaults produce bad budgets. Defaults are clearly shown
  and easy to override.

### Follow-ups
- Once maintenance history exists (recommended ADR), actual costs can calibrate
  `maintenance_pct_per_year` per tenant.
