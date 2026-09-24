// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0010: ADRs live in ai-docs/decisions (source of truth); copy them into the site at build time.
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(docsDir, '..', 'ai-docs', 'decisions');
const dest = join(docsDir, 'architecture', 'decisions');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const file of readdirSync(src).filter((f) => f.endsWith('.md'))) {
	cpSync(join(src, file), join(dest, file));
}
renameSync(join(dest, 'README.md'), join(dest, 'index.md'));
