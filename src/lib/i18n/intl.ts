// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0007: dates and numbers via Intl only.

export function formatDateTime(locale: string, value: Date | string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(value)
	);
}
