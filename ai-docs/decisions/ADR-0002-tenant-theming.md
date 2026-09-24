# ADR-0002: Dynamic CSS Variable-Based Tenant Theming System

- **Status:** Active
- **Date:** 2026-09-24
- **Deciders:** Project maintainer, Theming/UI agent
- **Related:** ADR-0001, ADR-0007

## Context

Clubs identify strongly with their colours and logo. Tenant admins want the app to "feel like our
club" without developer involvement. Constraints:

- Lightweight: no per-tenant CSS build, no runtime CSS-in-JS library.
- Safe: tenant-supplied values must never allow CSS/HTML injection or break accessibility.
- Fast: no flash of unstyled/default theme (FOUC) on first paint.

## Decision

### 1. Design tokens as CSS custom properties

- The component stylesheet is a single static, cacheable file that references **only** tokens,
  never literal brand colours: `background: var(--ra-color-primary);`.
- Token namespace: `--ra-*`. Tenant-overridable tokens are an explicit allow-list:

  | Token                        | Type         | Default    |
  |------------------------------|--------------|------------|
  | `--ra-color-primary`         | hex colour   | `#1f4e79`  |
  | `--ra-color-primary-contrast`| derived      | computed   |
  | `--ra-color-secondary`       | hex colour   | `#c9a227`  |
  | `--ra-color-secondary-contrast` | derived   | computed   |
  | `--ra-color-accent`          | hex colour   | = primary  |
  | `--ra-radius`                | enum         | `md` → `6px` (`none`/`sm`/`md`/`lg`) |
  | `--ra-font-family`           | enum         | `system`  (`system`/`serif`/`rounded`) |
  | `--ra-density`               | enum         | `comfortable` |

- Shades (hover, subtle backgrounds) are derived in CSS with `color-mix()`, not stored.

### 2. Validation on write, never raw CSS

- `theme_settings` stores **typed values**, not CSS strings. Colours must match
  `^#[0-9a-fA-F]{6}$`; enums are validated against the allow-list.
- On save, the server computes contrast colours (black/white) per WCAG 2.2 relative luminance and
  rejects combinations below AA (4.5:1 for text on primary/secondary). The UI shows a live preview
  and the contrast warning before saving.
- There is no "custom CSS" field. (See recommendations for a possible future, sandboxed option.)

### 3. Injection: server-rendered inline `<style>` in `<head>`

- For any `/t/{slug}/…` page, the server emits, before the main stylesheet link:
  ```html
  <style id="ra-tenant-theme" nonce="{cspNonce}">
    :root{--ra-color-primary:#1f4e79;--ra-color-primary-contrast:#ffffff;…}
  </style>
  ```
- The serialized block is generated from validated values and cached per tenant keyed by
  `theme_settings.version`; the cache is invalidated on save.
- On client-side tenant switch, the app fetches `/t/{slug}/theme.css` (ETag = version) and swaps
  the `<style>` contents — no page reload needed.
- Dark mode: the tenant sets brand colours only; the platform owns light/dark surface tokens
  under `@media (prefers-color-scheme: dark)` and user override `data-theme`.

### 4. Logos

- Accepted formats: PNG, WebP, JPEG, max 512 KB, max 1024×1024; re-encoded server-side and
  stripped of metadata. **SVG is rejected** (script/XSS vector) unless a vetted sanitizer is
  introduced by a future ADR.
- Served from a tenant-scoped, content-hashed URL with long-lived caching.

## Consequences

### Positive
- Zero per-tenant build; one static stylesheet for everyone, cached by CDN/browser.
- No FOUC; theme arrives with the HTML.
- Injection is structurally impossible: only typed values reach the template.
- Accessibility is enforced, not hoped for.

### Negative / trade-offs
- Tenants cannot fully restyle the app; only the allow-listed tokens.
- `color-mix()` requires modern browsers (baseline 2023). Acceptable for our audience; provide
  sensible fallbacks for primary/secondary only.
- Inline `<style>` requires a CSP nonce or hash.

### Follow-ups
- Visual regression test with 3 reference themes (default, dark brand, very light brand).
