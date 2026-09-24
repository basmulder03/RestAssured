# ADR-0014: Spreadsheet Import & Export

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0005, ADR-0007, ADR-0009, ADR-0013

## Context

Every club starts with one or more Excel sheets: Dutch headers (*Merk, Serienr, Verzekerde waarde,
Waar*), merged cells, subtotal rows, years like "±1995", prices in guilders from before 2002,
and names of members in the *Waar* column. Onboarding has to turn this into clean data without a
developer. Clubs also want their data back out (portability, and to avoid lock-in).

## Decision

### Import
- Formats: `.xlsx` via **ExcelJS** (MIT) and `.csv` (built-in parser, `;` and `,` delimiters,
  UTF-8 and Windows-1252). The SheetJS npm package is not used (the npm release is outdated and
  newer versions are only distributed outside npm).
- Server-side, streaming, max 5 MB / 10 000 rows per file.
- **Wizard flow:** upload → pick sheet → detect header row → map columns (auto-suggested from
  `locales/*/import_synonyms.json`) → value normalisation preview → dry run report → commit.
- **Normalisation rules:**
  - Currency: parses `€ 1.234,56`, `1234.56`, `fl. 2.500`. Guilder amounts (`fl`, `ƒ`, `NLG`, or
    a column flagged "guilders") are converted at the fixed rate 2.20371 NLG = 1 EUR, and the
    original is kept in the import report.
  - Years: `1995`, `'95`, `±1995`, `ca. 1995` → 1995 plus an `approximate` flag. Anything else →
    empty, reported.
  - Ownership: `Vereniging/Club/V` → `club`; `Privé/Prive/Eigen/P` → `private`.
  - *Waar* column: matched against existing locations and member display names. Unmatched values
    are offered as "create location" or "create member (reference, no account)". Nothing is created without
    confirmation.
  - Duplicate serial numbers within the file or against existing data → warning with a
    skip/merge/create choice.
- The commit runs in one transaction per import. An `import_batches` row records the uploader,
  file hash, and counts, and new rows reference `import_batch_id` so a whole batch can be undone
  within 7 days if it has no later edits.
- The uploaded file is deleted after commit or after 24 h (it contains PII). Only the report
  (without cell values from PII-mapped columns) is kept.
- Permission: `data:import`.

### Export
- `data:export`: assets (+ custom fields, + open assignment) as `.xlsx` and `.csv` with localised
  headers. Financial columns only with `assets:view_financials`.
- Full tenant export (ADR-0018) as a ZIP of JSON + CSV for portability.

## Consequences

- Onboarding a club is self-service and repeatable, and mistakes can be undone.
- The import code is the most edge-case-heavy module. It needs a fixture corpus of anonymised,
  real-world-shaped sheets in `tests/fixtures/imports/`.
