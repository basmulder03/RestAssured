// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { formatMessage, messageVariables } from '$lib/i18n/format';
import { buildDictionaries, createTranslator, dictionaries, resolveLocale } from '$lib/i18n';

describe('formatMessage', () => {
	it('interpolates variables and leaves unknown ones visible', () => {
		expect(formatMessage('Hallo {name}, {missing}', 'nl', { name: 'Anna' })).toBe(
			'Hallo Anna, {missing}'
		);
	});

	it('selects plural forms per locale, with exact matches first', () => {
		const msg = '{count, plural, =0 {geen items} one {# item} other {# items}}';
		expect(formatMessage(msg, 'nl', { count: 0 })).toBe('geen items');
		expect(formatMessage(msg, 'nl', { count: 1 })).toBe('1 item');
		expect(formatMessage(msg, 'nl', { count: 1500 })).toBe('1.500 items');
		expect(formatMessage(msg, 'en', { count: 1500 })).toBe('1,500 items');
	});

	it('combines plurals and variables', () => {
		expect(
			formatMessage('{name} has {count, plural, one {# asset} other {# assets}}', 'en', {
				name: 'Jo',
				count: 2
			})
		).toBe('Jo has 2 assets');
	});

	it('allows variables inside plural options', () => {
		const msg = '{count, plural, one {# instrument for {name}} other {# instruments for {name}}}';
		expect(formatMessage(msg, 'en', { count: 3, name: 'Jo' })).toBe('3 instruments for Jo');
	});

	it('lists variables for lint parity', () => {
		expect(messageVariables('{a} {n, plural, one {#} other {# {b}}} {a}')).toEqual(['a', 'b', 'n']);
		expect(messageVariables('{b} and {a}')).toEqual(['a', 'b']);
	});
});

describe('translator', () => {
	const dicts = buildDictionaries({
		'/locales/nl/common.json': { hello: 'Hallo {name}', only_nl: 'Alleen NL' },
		'/locales/en/common.json': { hello: 'Hello {name}' }
	});

	it('maps files to namespaced keys', () => {
		expect(dicts.nl['common.hello']).toBe('Hallo {name}');
	});

	it('falls back to nl, then to the key', () => {
		const t = createTranslator('en', dicts);
		expect(t('common.hello', { name: 'Jo' })).toBe('Hello Jo');
		expect(t('common.only_nl')).toBe('Alleen NL');
		expect(t('common.nope')).toBe('common.nope');
	});

	it('loads the real dictionaries', () => {
		expect(dictionaries.nl['common.app_name']).toBe('RestAssured');
	});
});

describe('resolveLocale', () => {
	it('follows user → tenant → Accept-Language → nl', () => {
		expect(resolveLocale({ userPreference: 'en', tenantDefault: 'nl' })).toBe('en');
		expect(resolveLocale({ userPreference: 'de', tenantDefault: 'en' })).toBe('en');
		expect(resolveLocale({ acceptLanguage: 'de-DE,en-GB;q=0.8,nl;q=0.5' })).toBe('en');
		expect(resolveLocale({ acceptLanguage: 'en;q=0.3, nl-BE;q=0.9' })).toBe('nl');
		expect(resolveLocale({ acceptLanguage: 'fr' })).toBe('nl');
		expect(resolveLocale({})).toBe('nl');
	});
});
