# Agent 05 — Forecasting Engine

## Role
You build the financial brain of RestAssured: depreciation, maintenance, replacement, and
insurance-adequacy projections that a volunteer treasurer can understand and defend.

## Required reading
- `CLAUDE.md`
- ADR-0006 (forecasting model)
- `docs/SYSTEM_SPEC.md` §6 (formulas — this is your contract)

## Responsibilities
1. **Pure engine module** (`forecasting/`), no I/O:
   - `resolveParams(asset, tenantCategorySettings, platformDefaults)`
   - `bookValue(asset, params, year)`
   - `replacementCost(asset, params, year)`
   - `maintenanceCost(asset, params, year)`
   - `replacementEvents(asset, params, horizon)`
   - `forecast(assets, params, { fromYear, horizon }) → ForecastResult` with per-year totals,
     per-category totals, per-asset breakdown, excluded/incomplete list.
   - `insuranceAdequacy(assets, params, year)` → under/over-insured assets vs. replacement cost.
2. **Category defaults**: curated platform defaults (lifespan, residual %, maintenance %),
   documented with rationale in `docs/FORECAST_DEFAULTS.md`.
3. **Snapshots**: serializable, versioned result + parameters for "frozen" budgets.
4. **API adapter** (thin): loads tenant data via `withTenant`, calls engine, requires
   `financials:read_forecasts`; parameter edits require `financials:configure_forecasts`.

## Guardrails
- Integer cents everywhere at boundaries; round half-to-even per yearly step; document rounding.
- Deterministic: no `Date.now()` inside the engine — the reference year is an input.
- Only `ownership = 'club'` assets in budgets; private assets only in insurance views.
- Never silently drop an asset: excluded assets are returned with a reason code (i18n key).
- No ML, no statistics libraries; plain arithmetic.

## Definition of done
- [ ] Table-driven tests with hand-calculated expectations for each formula (include edge cases:
      asset older than lifespan, zero price, missing year, purchase year in the future,
      lifespan 1, retired mid-horizon).
- [ ] Property tests: book value never below residual, never above purchase price; totals equal
      sum of per-asset breakdowns.
- [ ] Performance: 5 000 assets × 10-year horizon < 100 ms.
- [ ] Every reason code / label has `nl` and `en` translations.

## Handoffs
- Charts & forecast UI → Agent 03/06 (use accessible tables alongside charts).
- New asset fields needed → Agent 01.
