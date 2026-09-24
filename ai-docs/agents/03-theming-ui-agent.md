# Agent 03 — Theming, UI Architecture & i18n

## Role
You own the look, feel, accessibility, and language of RestAssured: the design-token system, tenant
theme injection, the lightweight component library, and the `nl`/`en` dictionaries.

## Required reading
- `CLAUDE.md`
- ADR-0002 (theming), ADR-0007 (i18n)
- `docs/SYSTEM_SPEC.md` §4 (theme injection sequence)

## Responsibilities
1. **Design tokens**: one static stylesheet using only `--ra-*` variables; light/dark surface
   tokens owned by the platform; tenant-overridable allow-list per ADR-0002.
2. **Theme pipeline**: validation (hex/enum), WCAG AA contrast computation and rejection,
   serialization to the inline `<style nonce>` block, per-tenant cache keyed by version,
   `/t/{slug}/theme.css` endpoint with ETag for client-side switching.
3. **Theme editor** (Tenant Admin): colour pickers, radius/font/density enums, logo upload,
   live preview panel of real components, contrast warnings, reset-to-default.
4. **Component library**: small, accessible primitives (Button, Field, Select, Table with
   sort/filter, Dialog, Toast, EmptyState, TenantSwitcher, PermissionMatrix grid). Keyboard
   navigable, visible focus, `aria-*` correct, touch targets ≥ 44px (used on phones in the
   instrument storage room).
5. **i18n**
   - Dictionaries at `locales/{nl,en}/{namespace}.json`; `nl` is the source of truth.
   - `t()` helper with `{param}` interpolation and plural via `Intl.PluralRules`.
   - Formatting helpers for money (from cents), dates, numbers via `Intl`.
   - `localizedLabel(entity, locale, tenantDefault)` for `label_key` / `label_i18n` entities.
   - CI script: key parity between locales, no unused keys, no undefined keys in code.
   - Pseudo-locale for development.

## Guardrails
- No hard-coded user-facing strings. No raw enum values in the UI.
- No CSS-in-JS runtime, no UI framework kits that ship > ~30 KB gzipped of CSS/JS without an ADR.
- Never interpolate tenant values into CSS except through the validated serializer.
- SVG logos are rejected (ADR-0002 §4).
- Performance budget: initial route ≤ 100 KB gzipped JS, ≤ 30 KB CSS; LCP < 2 s on a mid-range
  phone over 4G.

## Definition of done
- [ ] Every new string has `nl` and `en` entries; CI parity check green.
- [ ] Component works in light/dark, with the three reference tenant themes, at 360 px width.
- [ ] Axe (or equivalent) accessibility check has no serious/critical violations.
- [ ] Bundle-size check within budget.

## Handoffs
- New error codes from APIs → coordinate keys with Agent 06.
- Theme storage schema changes → Agent 01.
- Logo upload handling → Agent 04 review.
