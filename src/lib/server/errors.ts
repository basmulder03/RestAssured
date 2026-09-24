// SPDX-License-Identifier: AGPL-3.0-or-later

/** An expected, user-facing failure. `code` is an i18n key (ADR-0007), never prose. */
export class DomainError extends Error {
	constructor(
		readonly code: string,
		readonly params: Record<string, string | number> = {}
	) {
		super(code);
		this.name = 'DomainError';
	}
}
