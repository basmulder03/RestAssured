# RestAssured Agent Roster

Each file in this directory is a self-contained prompt definition for a specialised agent. Load
the file as the agent's system/role prompt, together with the project root `CLAUDE.md`.

| # | Agent                        | Owns                                                        | Primary ADRs |
|---|------------------------------|-------------------------------------------------------------|--------------|
| 01 | [Architect](01-architect-agent.md) | Schema, tenancy isolation, API route security, ADR stewardship | 0001, all |
| 02 | [Auth & Permissions](02-auth-permissions-agent.md) | RBAC engine, sessions, tenant switcher, magic links, resets | 0003, 0004 |
| 03 | [Theming & UI](03-theming-ui-agent.md) | Design tokens, theme injection, component library, i18n dictionaries | 0002, 0007 |
| 04 | [GDPR & Security](04-gdpr-security-agent.md) | PII inventory, anonymization engine, security review | 0005, 0001, 0004 |
| 05 | [Forecasting Engine](05-forecasting-engine-agent.md) | Depreciation, maintenance, replacement budget models | 0006 |
| 06 | [Full-Stack Implementer](06-fullstack-implementer-agent.md) | Feature delivery: screens, handlers, checkout flows | all (consumer) |
| 07 | [Data Importer](07-data-importer-agent.md) | Spreadsheet import wizard, normalisers, exports | 0014, 0013, 0022 |
| 08 | [Reports](08-reports-agent.md) | Insurance schedules, ALV budget annex, labels (print CSS) | 0006, 0015 |
| 09 | [QA & Test Harness](09-qa-test-harness-agent.md) | Test infra, isolation/authz generators, schema & i18n lint | 0001, 0003, 0005, 0011 |
| 10 | [Accessibility & Performance](10-a11y-performance-agent.md) | Size budgets, axe, WCAG, query performance | 0002, 0008 |
| 11 | [DevOps, Release & Licences](11-devops-release-agent.md) | Container, compose, backups, CI, licence compliance | 0008–0011 |
| 12 | [Docs & Onboarding](12-docs-onboarding-agent.md) | VitePress site on GitHub Pages, user guides, in-code doc standard | 0010, 0009 |
| 13 | [Domain Data Curator](13-domain-data-curator-agent.md) | Category defaults, role templates, import synonyms | 0006, 0014 |

## Collaboration rules

1. **ADR-first.** Any agent that needs to deviate from an Active ADR hands off to the Architect
   agent with a `Proposed` ADR draft. No agent silently works around an ADR.
2. **Ownership, not exclusivity.** Any agent may edit any file, but changes inside another
   agent's area must be reviewed against that agent's checklist (copy it into the PR).
3. **Security review is mandatory** (agent 04 checklist) for changes touching: auth, sessions,
   tokens, RLS policies, PII columns, file uploads, or the theme injection path.
4. **Handoff format.** When handing off, write a short note: *goal · files touched · open
   questions · ADRs relied on · tests added*.
