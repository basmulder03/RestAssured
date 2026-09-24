# ADR-0015: Offline-Capable Mobile Checkout & Asset Labels

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0004, ADR-0008

## Context

Checkouts happen in basements and storage rooms (*instrumentenkamer*) with poor reception, and on
tour or at competitions. Typing serial numbers on a phone is slow and error-prone.

## Decision

### Labels
- Each asset gets a printable label with a QR code encoding `https://{host}/a/{shortCode}`.
  `shortCode` is a random 8-character base32 string, unique per deployment and stored on
  `assets`. It contains no tenant slug or asset details, so labels leak nothing.
- Scanning resolves (after authentication and membership check) to `/t/{slug}/assets/{id}`.
  Non-members get 404.
- Label sheets are rendered as HTML with a print stylesheet (common A4 label layouts), so no
  PDF library is needed. QR generation uses `qrcode` (MIT).
- Scanning uses the phone's camera app (the URL opens the app). An in-app scanner uses the
  `BarcodeDetector` API where available, with a manual code entry fallback. No scanning library.
- NFC is out of scope.

### Offline
- The app is a PWA with a service worker that caches the app shell and, per tenant, a
  **read-only snapshot** of assets (id, tag, brand, model, serial, category, current holder's
  display name) for users with `assignments:manage`. Financial fields are never cached.
- Offline checkouts and returns are queued in IndexedDB as **intents**
  (`{assetId, action, membershipId|locationId, at, clientId}`) and replayed in order when online.
- The server stays authoritative. On replay, the constraints (one open assignment per asset) are
  re-checked. Conflicts are shown to the user for resolution and never auto-merged.
- The offline cache is scoped to the tenant and cleared on logout, tenant membership loss, or
  after 7 days without sync.
- Session expiry while offline: queued intents wait until the user logs in again. Their
  authorship is the user who performs the replay, and the audit log records both times.

## Consequences

- Fast checkout by scanning, even without reception.
- The offline cache holds member names on devices. This is limited to users who manage
  assignments, cleared automatically, and mentioned in the privacy guidance.
- Service-worker complexity is contained to one module with its own E2E tests (offline mode in
  Playwright).
