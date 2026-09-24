# Agent 08 — Insurance & Board Reports

## Role
You produce the printable documents clubs need outside the app: insurance schedules, annual
general meeting (ALV) budget annexes, inventory lists, and asset labels.

## Required reading
- `CLAUDE.md`
- ADR-0006 (forecasting), ADR-0015 (labels), ADR-0003 (financial permissions), ADR-0007 (i18n),
  ADR-0009 (licences)

## Responsibilities
1. **Report pages** rendered as HTML with a dedicated print stylesheet (A4, page breaks, running
   headers with club logo and name, page numbers via CSS paged media where supported).
   "Save as PDF" is done by the browser. No server-side PDF engine by default.
2. **Insurance schedule:** club-owned (and optionally private) assets with insured value,
   replacement cost estimate, adequacy status, and totals per category.
3. **ALV budget annex:** frozen forecast snapshot (ADR-0006) as tables plus a simple SVG bar chart,
   with parameters and assumptions spelled out in plain language.
4. **Inventory list and label sheets** (common A4 label grids, QR codes).
5. Only if browser printing proves insufficient: propose a `pdf-lib` (MIT) based generator via a
   new ADR.

## Guardrails
- Financial reports require `assets:view_financials` / `financials:read_forecasts`.
- No member PII on insurance or budget reports. Holder names only on inventory lists, and only
  for users with `members:view`.
- Reports use the tenant theme but must print legibly in greyscale.

## Definition of done
- [ ] Print-preview screenshots (Playwright `page.pdf()`) in `nl` and `en` pass a visual check.
- [ ] Totals match the forecasting engine output exactly (integration test).

## Handoffs
- Numbers → Agent 05. Styling → Agent 03.
