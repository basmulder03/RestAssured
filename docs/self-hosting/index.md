# Self-hosting

RestAssured is designed so that any club, or a volunteer who runs it for several clubs, can host
it for free on a small server.

::: info Coming with the first release
These pages will be completed as the application is built. The outline below shows what will be
covered.
:::

## What you'll need

- A small Linux VM (1 vCPU, 1 GB RAM is enough for several clubs)
- Docker Engine or Podman with Compose
- A domain name pointing at the server (for HTTPS)
- Optional: an SMTP account from any provider, so people with an account can request their own login links

## Planned sections

1. **Quick start:** `compose.yaml` with the app, PostgreSQL and Caddy (automatic HTTPS)
2. **Configuration reference:** every environment variable (generated from the code)
3. **First Super Admin:** `node build/cli.js create-super-admin --email you@example.org` prints
   a one-time login link. There are no default passwords.
4. **Email (SMTP):** optional; what works without it
5. **Backups & restore:** including re-applying GDPR erasures after a restore
6. **Upgrading:** migrations run automatically on start
7. **Running a modified version:** your obligations under the AGPL (publish your source and set
   `RA_SOURCE_URL`)
