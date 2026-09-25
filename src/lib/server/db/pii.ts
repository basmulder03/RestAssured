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
			'credential_scope_tenant_id',
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
	},
	assets: {
		pii: { description: 'free_text' },
		notPii: [
			'tenant_id',
			'id',
			'category_id',
			'tag',
			'brand',
			'model',
			'serial_number',
			'purchase_price_cents',
			'purchase_year',
			'insured_value_cents',
			'insured_value_year',
			'ownership',
			'owner_membership_id',
			'status',
			'lifespan_years',
			'created_at',
			'updated_at'
		]
	},
	assignments: {
		pii: { condition_out: 'free_text', condition_in: 'free_text', notes: 'free_text' },
		notPii: [
			'tenant_id',
			'id',
			'asset_id',
			'membership_id',
			'location_id',
			'checked_out_at',
			'returned_at',
			'issued_by_membership_id',
			'returned_by_membership_id'
		]
	}
} as const satisfies Record<string, Classification>;
