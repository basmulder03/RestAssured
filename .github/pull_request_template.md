## What & why

<!-- Short description. Reference ADRs (ADR-00XX) and issues. -->

## Checklist

- [ ] Commits are signed off (`git commit -s`) and follow Conventional Commits
- [ ] Tests added/updated and passing
- [ ] No hard-coded user-facing strings; `nl` and `en` keys added
- [ ] Docs updated (user guide / self-hosting / config reference) if behaviour or config changed
- [ ] New dependencies: licence on ADR-0009 allow-list, free of cost, justified below
- [ ] Touches auth, tokens, RLS, PII, uploads or theme injection → security checklist
      (`ai-docs/agents/04-gdpr-security-agent.md`) completed below

## New dependencies (if any)

| Package | Licence | Size | Why not native/hand-written |
|---|---|---|---|
