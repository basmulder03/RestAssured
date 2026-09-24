# RestAssured

**Asset management and cost forecasting for music clubs, marching bands and orchestras.**
*Instrumenten-, kleding- en materiaalbeheer voor muziekverenigingen.*

RestAssured keeps track of your club's instruments, uniforms, accessories and cases: who has what,
where it is, what it's worth, what it's insured for, and how much you should reserve each year to
maintain and replace it.

> **Status: pre-alpha.** Architecture and specifications are in place; the application is being
> built. Not ready for production use.

## Features (planned for v1.0)

- Multi-club: one installation serves many clubs, strictly isolated from each other. One login
  for people who play in several clubs.
- Assets with brand, model, serial number, purchase price and year, insured value, and club or
  private ownership. Check-out and check-in with full history.
- Multi-year forecasts of depreciation, maintenance and replacement budgets.
- Club-defined roles with fine-grained permissions (board member, quartermaster, …).
- Login by magic link, with no email provider required to get started.
- Club branding: colours and logo.
- GDPR: anonymize members while keeping asset history intact.
- Dutch and English.

## Documentation

The documentation site (self-hosting, user guides, architecture) is built from [`docs/`](docs/)
and published to GitHub Pages.

- Architecture decisions: [`ai-docs/decisions/`](ai-docs/decisions/README.md)
- System specification: [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md)

## Self-hosting

RestAssured is meant to be self-hosted by anyone: one container plus PostgreSQL on a small VM.
Instructions will be in the documentation's *Self-hosting* section once the first release is
available.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md).

## Licence

[GNU Affero General Public License v3.0 or later](LICENSE). You may use, modify and host
RestAssured for free. If you run a **modified** version for others over a network, you must make
your modified source code available to its users (AGPL §13). The app's "Source code" link
(`RA_SOURCE_URL`) exists for this purpose.
