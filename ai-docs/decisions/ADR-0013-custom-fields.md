# ADR-0013: Tenant-Defined Custom Fields

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0005, ADR-0007

## Context

Uniforms need size and fit, instruments need tuning or key (B♭, E♭), and percussion needs
dimensions. Every club tracks slightly different things. Adding columns per request doesn't scale.
Generic entity-attribute-value (EAV) tables are slow and hard to validate.

## Decision

- `custom_field_definitions` (tenant table): `id`, `category_id` (nullable = all categories),
  `key` (stable slug), `label_i18n` (`{nl, en}`), `type` (`text` | `number` | `integer` | `date` |
  `boolean` | `select` | `multiselect`), `options` (for selects: `[{value, label_i18n}]`),
  `required`, `sort_order`, `is_pii` (default `false`; `text` fields get a warning to avoid
  personal data), `archived_at`.
- Values are stored in `assets.custom_fields jsonb`, keyed by definition `key`. They are validated
  in application code against the definitions on every write (Valibot schema built from
  definitions and cached per tenant version).
- Filtering and sorting on custom fields use JSONB operators, with a GIN index on
  `custom_fields`. Limits: 30 definitions per category, 1 KB per text value.
- Deleting a definition **archives** it: values stay hidden and are removed only by an explicit
  purge action.
- Custom fields marked `is_pii` are scrubbed by the anonymization engine (ADR-0005) when they
  relate to a member (only relevant for future custom fields on members).
- Import (ADR-0014) can map unknown spreadsheet columns into new custom fields.
- New permission `tenant:manage_fields`.

## Consequences

- One flexible column instead of schema churn. Values are validated, translated, and indexed.
- Reporting on custom fields is less efficient than on real columns. If one custom field becomes
  universal across tenants, promote it to a real column via migration.
