// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { formatMoney, moneyInputValue, parseMoney, parseYear } from '$lib/domain/money';

describe('parseMoney', () => {
	it.each([
		['', 'nl', null],
		['  ', 'nl', null],
		['1234', 'nl', 123400],
		['1234,5', 'nl', 123450],
		['1234,56', 'nl', 123456],
		['1234.56', 'nl', 123456],
		['1.234,56', 'nl', 123456],
		['1,234.56', 'nl', 123456],
		['€ 1.250,-', 'nl', 125000],
		['€1.250', 'nl', 125000],
		['1.250', 'en', 'invalid'],
		['1,250', 'en', 125000],
		['1,250', 'nl', 'invalid'],
		['1.234.567', 'nl', 123456700],
		['1,234,567.89', 'en', 123456789],
		['0,99', 'en', 99],
		['EUR 45', 'en', 4500]
	])('%s (%s) → %s', (input, locale, expected) => {
		expect(parseMoney(input, locale)).toBe(expected);
	});

	it.each(['abc', '-5', '12,345,6', '1.2.3,4.5', '12,345', '1,2345', '12.3.4'])(
		'rejects %s',
		(input) => {
			// '12,345' in nl reads as three decimals: ambiguous, so rejected.
			expect(parseMoney(input, 'nl')).toBe('invalid');
		}
	);

	it('rejects absurd amounts', () => {
		expect(parseMoney('999999999999', 'nl')).toBe('invalid');
	});
});

describe('formatMoney / moneyInputValue', () => {
	it('formats cents per locale', () => {
		// Intl puts a non-breaking space after the euro sign in Dutch.
		expect(formatMoney('nl', 123456).replace('\u00a0', ' ')).toBe('€ 1.234,56');
		expect(formatMoney('en', 123456)).toBe('€1,234.56');
		expect(moneyInputValue('nl', 123450)).toBe('1234,50');
		expect(moneyInputValue('en', 123450)).toBe('1234.50');
		expect(moneyInputValue('nl', null)).toBe('');
	});
});

describe('parseYear', () => {
	const now = new Date('2026-09-25');
	it('accepts plausible years only', () => {
		expect(parseYear('', now)).toBeNull();
		expect(parseYear('1995', now)).toBe(1995);
		expect(parseYear('2027', now)).toBe(2027);
		expect(parseYear('2028', now)).toBe('invalid');
		expect(parseYear('1899', now)).toBe('invalid');
		expect(parseYear('95', now)).toBe('invalid');
	});
});
