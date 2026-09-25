// SPDX-License-Identifier: AGPL-3.0-or-later
// Money is integer cents everywhere (ADR-0006, ADR-0007); these convert at the edges.

export const MAX_CENTS = 100_000_000_00; // €100M: far beyond any club asset, catches typos.

/**
 * Parses an amount typed by a person into cents. Accepts `1234`, `1234,5`, `1.234,56`,
 * `1,234.56`, `€ 1.250,-`. With a single separator followed by exactly three digits the locale
 * decides: `1.250` is 1250 in `nl`, `1,250` is 1250 in `en`; the other reading (three
 * decimals) is ambiguous and rejected rather than guessed.
 * @returns cents, null for empty input, or 'invalid'.
 */
export function parseMoney(input: string, locale: string): number | null | 'invalid' {
	const s = input.replace(/[\s\u00a0€]|EUR/gi, '').replace(/[,.]-$/, '');
	if (s === '') return null;
	if (!/^\d[\d.,]*$/.test(s)) return 'invalid';

	const decimal = decimalSeparator(s, locale);
	if (decimal === 'ambiguous') return 'invalid';
	const [intPart = '', fraction = ''] = decimal
		? [s.slice(0, s.lastIndexOf(decimal)), s.slice(s.lastIndexOf(decimal) + 1)]
		: [s];
	const thousands =
		decimal === '.' ? ',' : decimal === ',' ? '.' : intPart.includes('.') ? '.' : ',';

	const groups = intPart.split(thousands);
	const [first = '', ...rest] = groups;
	if (
		!/^\d+$/.test(first) ||
		(rest.length > 0 && (first.length > 3 || rest.some((g) => !/^\d{3}$/.test(g))))
	) {
		return 'invalid';
	}
	if (!/^\d{0,2}$/.test(fraction)) return 'invalid';

	const cents = Number(groups.join('')) * 100 + Number(fraction.padEnd(2, '0'));
	return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : 'invalid';
}

function decimalSeparator(s: string, locale: string): '.' | ',' | null | 'ambiguous' {
	const lastDot = s.lastIndexOf('.');
	const lastComma = s.lastIndexOf(',');
	if (lastDot >= 0 && lastComma >= 0) return lastDot > lastComma ? '.' : ',';
	if (lastDot < 0 && lastComma < 0) return null;
	const sep = lastDot >= 0 ? '.' : ',';
	if (s.split(sep).length > 2) return null; // 1.234.567: only thousands separators
	if (s.length - s.lastIndexOf(sep) - 1 !== 3) return sep; // 12,5 or 12.50
	const localeDecimal = locale.startsWith('en') ? '.' : ',';
	return sep === localeDecimal ? 'ambiguous' : null;
}

export function formatMoney(locale: string, cents: number, currency = 'EUR'): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** For pre-filling an input: `1234,50` (nl) / `1234.50` (en), without thousands separators. */
export function moneyInputValue(locale: string, cents: number | null): string {
	if (cents === null) return '';
	const value = (cents / 100).toFixed(2);
	return locale.startsWith('en') ? value : value.replace('.', ',');
}

/** A purchase or valuation year: four digits, not before 1900, at most next year. */
export function parseYear(input: string, now = new Date()): number | null | 'invalid' {
	const s = input.trim();
	if (s === '') return null;
	if (!/^\d{4}$/.test(s)) return 'invalid';
	const year = Number(s);
	return year >= 1900 && year <= now.getFullYear() + 1 ? year : 'invalid';
}
