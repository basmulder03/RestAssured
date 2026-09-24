// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0007: a minimal ICU subset. `{name}` interpolation and
// `{count, plural, =0 {…} one {…} other {…}}` with `#` for the number. Plural options may
// contain `{name}` variables, but not other plurals.

export type MessageParams = Record<string, string | number>;

const OPTION_BODY = String.raw`(?:[^{}]|\{\w+\})*`;
const PLURAL = new RegExp(
	String.raw`\{(\w+),\s*plural,\s*((?:\s*=?\w+\s*\{${OPTION_BODY}\})+)\s*\}`,
	'g'
);
const PLURAL_OPTION = new RegExp(String.raw`(=?\w+)\s*\{(${OPTION_BODY})\}`, 'g');
const VARIABLE = /\{(\w+)\}/g;

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
	let rules = pluralRulesCache.get(locale);
	if (!rules) pluralRulesCache.set(locale, (rules = new Intl.PluralRules(locale)));
	return rules;
}

export function formatMessage(message: string, locale: string, params: MessageParams = {}): string {
	const withPlurals = message.replace(PLURAL, (whole, name: string, body: string) => {
		const value = params[name];
		if (typeof value !== 'number') return whole;
		const options = new Map([...body.matchAll(PLURAL_OPTION)].map((m) => [m[1], m[2] ?? '']));
		const chosen =
			options.get(`=${value}`) ??
			options.get(pluralRules(locale).select(value)) ??
			options.get('other');
		return (chosen ?? '').replaceAll('#', new Intl.NumberFormat(locale).format(value));
	});
	return withPlurals.replace(VARIABLE, (whole, name: string) =>
		name in params ? String(params[name]) : whole
	);
}

/** Placeholder names used in a message, for lint parity checks between locales. */
export function messageVariables(message: string): string[] {
	const names = new Set<string>();
	for (const m of message.matchAll(PLURAL)) {
		if (m[1]) names.add(m[1]);
		for (const v of (m[2] ?? '').matchAll(VARIABLE)) if (v[1]) names.add(v[1]);
	}
	for (const m of message.replace(PLURAL, '').matchAll(VARIABLE)) if (m[1]) names.add(m[1]);
	return [...names].sort();
}
