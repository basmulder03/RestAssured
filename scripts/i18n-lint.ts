// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0007 checks: nl/en key parity, placeholder parity, key format, no undefined keys used in
// t(...) calls, no unused keys. Permission keys count as used when the permission exists.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
	PERMISSIONS,
	PERMISSION_GROUPS,
	permissionDescriptionKey,
	permissionGroupKey,
	permissionLabelKey
} from '../src/lib/domain/permissions';
import { buildDictionaries, type Dictionary } from '../src/lib/i18n/dictionaries';
import { messageVariables } from '../src/lib/i18n/format';
import { DEFAULT_LOCALE, LOCALES } from '../src/lib/i18n/locales';

const KEY_FORMAT = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

function walk(dir: string, filter: (f: string) => boolean): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return walk(path, filter);
		return filter(path) ? [path] : [];
	});
}

const sources: Record<string, Dictionary> = {};
for (const file of walk('locales', (f) => f.endsWith('.json'))) {
	sources[`/${file}`] = JSON.parse(readFileSync(file, 'utf8')) as Dictionary;
}
const dicts = buildDictionaries(sources);
const reference = dicts[DEFAULT_LOCALE];
const errors: string[] = [];

for (const key of Object.keys(reference)) {
	if (!KEY_FORMAT.test(key)) errors.push(`Invalid key format: ${key}`);
}
for (const locale of LOCALES) {
	if (locale === DEFAULT_LOCALE) continue;
	const dict = dicts[locale];
	for (const key of Object.keys(reference)) {
		if (!(key in dict)) errors.push(`[${locale}] missing key: ${key}`);
		else if (
			messageVariables(dict[key] ?? '').join() !== messageVariables(reference[key] ?? '').join()
		) {
			errors.push(`[${locale}] placeholders differ from ${DEFAULT_LOCALE}: ${key}`);
		}
	}
	for (const key of Object.keys(dict)) {
		if (!(key in reference)) errors.push(`[${locale}] key not in ${DEFAULT_LOCALE}: ${key}`);
	}
}

// Usage: any string literal equal to a key counts; t('…') literals must exist.
const used = new Set<string>([
	...PERMISSIONS.flatMap((p) => [permissionLabelKey(p.code), permissionDescriptionKey(p.code)]),
	...PERMISSION_GROUPS.map(permissionGroupKey)
]);
const codeFiles = walk('src', (f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f));
for (const file of codeFiles) {
	const code = readFileSync(file, 'utf8');
	for (const m of code.matchAll(/['"`]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"`]/g)) {
		if (m[1] && m[1] in reference) used.add(m[1]);
	}
	for (const m of code.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
		if (m[1] && !(m[1] in reference)) errors.push(`${relative('.', file)}: undefined key ${m[1]}`);
	}
}
for (const key of Object.keys(reference)) {
	if (!used.has(key)) errors.push(`Unused key: ${key}`);
}

if (errors.length) {
	console.error(`i18n lint failed:\n  ${errors.join('\n  ')}`);
	process.exit(1);
}
console.log(`i18n lint passed: ${Object.keys(reference).length} keys × ${LOCALES.length} locales.`);
