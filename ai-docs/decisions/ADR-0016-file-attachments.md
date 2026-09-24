# ADR-0016: File Attachments & Photos

- **Status:** Proposed
- **Date:** 2026-09-24
- **Related:** ADR-0001, ADR-0002, ADR-0005, ADR-0009, ADR-0012

## Context

Clubs want photos of assets (condition, damage), invoices, and insurance policies attached to
assets and maintenance events. Photos from phones carry EXIF metadata including GPS location.
Operators are self-hosting on small servers with limited disk space.

## Decision

- **Storage backend interface** with two implementations:
  1. `filesystem` (default): a mounted volume, path `/{tenantId}/{attachmentId}`.
  2. `s3` (optional): any S3-compatible store the operator chooses. It uses a minimal SigV4
     client or the smallest licence-compliant SDK module. No provider is required.
- Metadata table `attachments` (tenant-scoped): `id`, `owner_type`, `owner_id`, `kind`
  (`photo` | `document`), `content_type`, `size_bytes`, `sha256`, `created_by_membership_id`.
- **Allowed types:** JPEG, PNG, WebP, HEIC (converted to WebP) for photos; PDF for documents.
  The type is detected from content, not from the extension.
- **Photos:** re-encoded with `sharp` to WebP, max 2048 px on the long side, all metadata (EXIF,
  GPS) stripped, and a 320 px thumbnail generated.
- **PDFs:** stored as-is and served with `Content-Disposition: attachment`, `Content-Type:
  application/pdf`, `X-Content-Type-Options: nosniff`, and a restrictive CSP. They are never
  rendered inline from our origin.
- **Serving:** always through the app with a tenant and permission check. No public URLs, no
  presigned URLs longer than 5 minutes.
- **Quotas:** per-tenant storage quota (default 1 GB, set by the platform). Uploads over quota
  fail with an error code.
- **Invoices/policies:** viewing requires `assets:view_financials`.
- Anonymization (ADR-0005) does not delete asset photos, but offers to delete photos uploaded by
  the member if they might depict them.

## Consequences

- Safe by default: no location leakage, no stored XSS through uploads.
- Backups must include the storage volume. The self-hosting docs cover this.
