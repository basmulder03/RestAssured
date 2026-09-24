// SPDX-License-Identifier: AGPL-3.0-or-later
import { isLocale, LOCALES, type Locale } from './locales';

export type Dictionary = Record<string, string>;

/** Maps `…/locales/{locale}/{namespace}.json` sources to flat `{namespace}.{key}` dictionaries. */
export function buildDictionaries(sources: Record<string, Dictionary>): Record<Locale, Dictionary> {
	const result = Object.fromEntries(LOCALES.map((l) => [l, {}])) as Record<Locale, Dictionary>;
	for (const [path, entries] of Object.entries(sources)) {
		const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
		if (!match?.[2] || !isLocale(match[1])) continue;
		for (const [key, message] of Object.entries(entries)) {
			result[match[1]][`${match[2]}.${key}`] = message;
		}
	}
	return result;
}
