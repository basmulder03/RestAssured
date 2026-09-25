// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildDictionaries, type Dictionary } from '$lib/i18n/dictionaries';
import { formatMessage, type MessageParams } from '$lib/i18n/format';
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from '$lib/i18n/locales';

export {
	buildDictionaries,
	DEFAULT_LOCALE,
	isLocale,
	LOCALES,
	type Dictionary,
	type Locale,
	type MessageParams
};

// locales/{locale}/{namespace}.json → full key `{namespace}.{key}` (ADR-0007).
const files = import.meta.glob<Dictionary>('/locales/*/*.json', { eager: true, import: 'default' });

export const dictionaries: Record<Locale, Dictionary> = buildDictionaries(files);

export type Translate = (key: string, params?: MessageParams) => string;

/** Falls back to the default locale, then to the key itself so missing text is visible. */
export function createTranslator(
	locale: Locale,
	dicts: Record<Locale, Dictionary> = dictionaries
): Translate {
	return (key, params) => {
		const message = dicts[locale][key] ?? dicts[DEFAULT_LOCALE][key];
		return message === undefined ? key : formatMessage(message, locale, params);
	};
}

/**
 * ADR-0007 resolution order: user preference → tenant default → Accept-Language → nl.
 */
export function resolveLocale(input: {
	userPreference?: string | null;
	tenantDefault?: string | null;
	acceptLanguage?: string | null;
}): Locale {
	if (isLocale(input.userPreference)) return input.userPreference;
	if (isLocale(input.tenantDefault)) return input.tenantDefault;
	for (const tag of parseAcceptLanguage(input.acceptLanguage ?? '')) {
		const base = tag.split('-')[0]?.toLowerCase();
		if (isLocale(base)) return base;
	}
	return DEFAULT_LOCALE;
}

function parseAcceptLanguage(header: string): string[] {
	return header
		.split(',')
		.map((part) => {
			const [tag = '', ...params] = part.trim().split(';');
			const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
			return { tag, q: q ? Number(q.slice(2)) : 1 };
		})
		.filter((x) => x.tag && x.q > 0)
		.sort((a, b) => b.q - a.q)
		.map((x) => x.tag);
}
