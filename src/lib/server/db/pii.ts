// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0005: every column of a table that holds personal data is classified here. The schema
// test fails when such a table gains a column that isn't listed, so new PII can't slip in
// unnoticed. The anonymization engine scrubs the `pii` columns.

export type PiiCategory = 'identity' | 'contact' | 'free_text';

type Classification = { pii: Record<string, PiiCategory>; notPii: readonly string[] };

export const PII_TABLES = {
	users: {
		pii: { email: 'identity' },
		notPii: [
			'id',
			'password_hash',
			'preferred_locale',
			'platform_role',
			'last_tenant_id',
			'email_verified_at',
			'erased_at',
			'created_at',
			'updated_at'
		]
	},
	tenant_memberships: {
		pii: {
			display_name: 'identity',
			email: 'contact',
			phone: 'contact',
			member_number: 'identity',
			notes: 'free_text'
		},
		notPii: [
			'tenant_id',
			'id',
			'user_id',
			'status',
			'pseudonym_id',
			'anonymized_at',
			'created_at',
			'updated_at'
		]
	}
} as const satisfies Record<string, Classification>;
