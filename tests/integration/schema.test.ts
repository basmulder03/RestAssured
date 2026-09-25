// SPDX-License-Identifier: AGPL-3.0-or-later
// Schema lint (ADR-0001, ADR-0005): structural rules every migration must keep.
import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '$lib/domain/permissions';
import { PII_TABLES } from '$lib/server/db/pii';
import type { DB } from '$lib/server/db/schema';
import { appUrl, connect, ownerUrl } from './db';

let owner: Kysely<DB>;
let app: Kysely<DB>;

beforeAll(() => {
	owner = connect(ownerUrl);
	app = connect(appUrl);
});

afterAll(async () => {
	await app.destroy();
	await owner.destroy();
});

describe('tenant tables', () => {
	it('have RLS enabled and forced, a tenant_isolation policy, and tenant_id leading the key', async () => {
		const { rows } = await sql<{
			table: string;
			rls: boolean;
			forced: boolean;
			policies: string[];
			pk_first: string | null;
		}>`
			SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
				coalesce(array_agg(DISTINCT p.polname) FILTER (WHERE p.polname IS NOT NULL), '{}') AS policies,
				(SELECT a.attname FROM pg_constraint k
					JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
					WHERE k.conrelid = c.oid AND k.contype = 'p') AS pk_first
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
			JOIN pg_attribute ta ON ta.attrelid = c.oid AND ta.attname = 'tenant_id' AND NOT ta.attisdropped
			LEFT JOIN pg_policy p ON p.polrelid = c.oid
			WHERE c.relkind = 'r'
			GROUP BY c.oid, c.relname`.execute(owner);

		expect(rows.length).toBeGreaterThan(0);
		for (const r of rows) {
			expect(r.rls, `${r.table}: RLS enabled`).toBe(true);
			expect(r.forced, `${r.table}: RLS forced`).toBe(true);
			expect(r.policies, `${r.table}: policy`).toContain('tenant_isolation');
			expect(r.pk_first, `${r.table}: primary key starts with tenant_id`).toBe('tenant_id');
		}
	});

	it('only reference other tenant tables through keys that include tenant_id', async () => {
		const { rows } = await sql<{ constraint: string; includes_tenant: boolean }>`
			SELECT k.conname AS constraint,
				EXISTS (SELECT 1 FROM unnest(k.conkey) AS col(attnum)
					JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = col.attnum
					WHERE a.attname = 'tenant_id') AS includes_tenant
			FROM pg_constraint k
			WHERE k.contype = 'f'
				AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.conrelid AND a.attname = 'tenant_id')
				AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.confrelid AND a.attname = 'tenant_id')`.execute(
			owner
		);
		for (const r of rows) expect(r.includes_tenant, r.constraint).toBe(true);
	});
});

describe('roles and privileges', () => {
	it('the app role cannot bypass RLS and owns nothing', async () => {
		const { rows } = await sql<{ super: boolean; bypass: boolean; owned: number }>`
			SELECT r.rolsuper AS super, r.rolbypassrls AS bypass,
				(SELECT count(*)::int FROM pg_class c WHERE c.relowner = r.oid) AS owned
			FROM pg_roles r WHERE r.rolname = 'ra_app'`.execute(owner);
		expect(rows[0]).toEqual({ super: false, bypass: false, owned: 0 });
	});

	it('audit logs are append-only for the app role', async () => {
		for (const table of ['audit_log', 'platform_audit_log']) {
			const { rows } = await sql<{ upd: boolean; del: boolean; ins: boolean }>`
				SELECT has_table_privilege('ra_app', ${table}, 'UPDATE') AS upd,
					has_table_privilege('ra_app', ${table}, 'DELETE') AS del,
					has_table_privilege('ra_app', ${table}, 'INSERT') AS ins`.execute(owner);
			expect(rows[0], table).toEqual({ upd: false, del: false, ins: true });
		}
	});

	it('the app role cannot read migration bookkeeping', async () => {
		await expect(sql`SELECT * FROM schema_migrations`.execute(app)).rejects.toThrow(
			/permission denied/
		);
	});
});

describe('permission catalogue sync', () => {
	it('mirrors the catalogue in code', async () => {
		const rows = await app.selectFrom('permissions').select(['code', 'is_dangerous']).execute();
		expect(rows.map((r) => r.code).sort()).toEqual(PERMISSIONS.map((p) => p.code).sort());
		for (const p of PERMISSIONS) {
			expect(rows.find((r) => r.code === p.code)?.is_dangerous, p.code).toBe(p.dangerous);
		}
	});
});

describe('PII inventory (ADR-0005)', () => {
	it('classifies every column of every table that holds personal data', async () => {
		for (const [table, classification] of Object.entries(PII_TABLES)) {
			const { rows } = await sql<{ column_name: string }>`
				SELECT column_name FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = ${table}`.execute(owner);
			const classified = new Set([...Object.keys(classification.pii), ...classification.notPii]);
			const actual = rows.map((r) => r.column_name);
			expect(
				actual.filter((c) => !classified.has(c)),
				`${table}: unclassified columns`
			).toEqual([]);
			expect(
				[...classified].filter((c) => !actual.includes(c)),
				`${table}: stale entries`
			).toEqual([]);
		}
	});
});
