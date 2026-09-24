// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0007: nl is the default and the source of truth for which keys exist.
export const LOCALES = ['nl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'nl';

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
