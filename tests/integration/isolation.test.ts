// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0001: tenant isolation holds at the database level, for every tenant table, even when
// application code forgets a WHERE clause.
import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DB } from '$lib/server/db/schema';
import { userMemberships, withTenant } from '$lib/server/db/tenant';
import { appUrl, connect, ownerUrl } from './db';
import { seedTenant, seedUser, type TenantFixture } from './fixtures';

let owner: Kysely<DB>;
let app: Kysely<DB>;
let a: TenantFixture;
let b: TenantFixture;
let sharedUser: string;
let tenantTables: string[];

beforeAll(async () => {
	owner = connect(ownerUrl);
	app = connect(appUrl);
	sharedUser = await seedUser(owner, 'shared@example.org');
	a = await seedTenant(owner, 'iso-a', sharedUser);
	b = await seedTenant(owner, 'iso-b', sharedUser);

	const { rows } = await sql<{ table_name: string }>`
		SELECT c.table_name FROM information_schema.columns c
		JOIN information_schema.tables t USING (table_schema, table_name)
		WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND t.table_type = 'BASE TABLE'
		ORDER BY 1`.execute(owner);
	tenantTables = rows.map((r) => r.table_name);
});

afterAll(async () => {
	await app.destroy();
	await owner.destroy();
});

// Append-only tables (no UPDATE/DELETE grant) are covered by the privilege test in schema.test.ts.
async function mutableTables(): Promise<string[]> {
	const { rows } = await sql<{ table_name: string }>`
		SELECT table_name FROM unnest(${tenantTables}::text[]) AS t(table_name)
		WHERE has_table_privilege('ra_app', table_name, 'UPDATE')
			AND has_table_privilege('ra_app', table_name, 'DELETE')`.execute(owner);
	return rows.map((r) => r.table_name);
}

async function countByTenant(
	db: Kysely<DB> | Parameters<Parameters<typeof withTenant>[2]>[0],
	table: string
) {
	const { rows } = await sql<{ tenant_id: string; n: string }>`
		SELECT tenant_id, count(*)::text AS n FROM ${sql.table(table)}
		WHERE tenant_id IN (${a.tenantId}, ${b.tenantId}) GROUP BY tenant_id`.execute(db);
	return Object.fromEntries(rows.map((r) => [r.tenant_id, Number(r.n)]));
}

describe('tenant isolation (RLS)', () => {
	it('covers every tenant table with seed data for both tenants', async () => {
		expect(tenantTables.length).toBeGreaterThan(0);
		for (const table of tenantTables) {
			const counts = await countByTenant(owner, table);
			expect(counts[a.tenantId], `${table}: seedTenant() must insert a row`).toBeGreaterThan(0);
			expect(counts[b.tenantId], `${table}: seedTenant() must insert a row`).toBeGreaterThan(0);
		}
	});

	it('returns no rows without a tenant context', async () => {
		for (const table of tenantTables) {
			expect(await countByTenant(app, table), table).toEqual({});
		}
	});

	it("only shows the current tenant's rows", async () => {
		for (const table of tenantTables) {
			const counts = await withTenant(app, a.tenantId, (trx) => countByTenant(trx, table));
			expect(Object.keys(counts), table).toEqual([a.tenantId]);
		}
	});

	it("can't update or delete another tenant's rows", async () => {
		for (const table of await mutableTables()) {
			const affected = await withTenant(app, a.tenantId, async (trx) => {
				const upd = await sql`UPDATE ${sql.table(table)} SET tenant_id = tenant_id
					WHERE tenant_id = ${b.tenantId}`.execute(trx);
				const del = await sql`DELETE FROM ${sql.table(table)}
					WHERE tenant_id = ${b.tenantId}`.execute(trx);
				return Number(upd.numAffectedRows) + Number(del.numAffectedRows);
			});
			expect(affected, table).toBe(0);
		}
		expect((await countByTenant(owner, 'roles'))[b.tenantId]).toBe(1);
	});

	it("can't move a row into another tenant", async () => {
		for (const table of tenantTables) {
			await expect(
				withTenant(app, a.tenantId, (trx) =>
					sql`UPDATE ${sql.table(table)} SET tenant_id = ${b.tenantId}
						WHERE tenant_id = ${a.tenantId}`.execute(trx)
				),
				table
			).rejects.toThrow(/row-level security|permission denied/);
		}
	});

	it("can't insert rows for another tenant", async () => {
		await expect(
			withTenant(app, a.tenantId, (trx) =>
				trx.insertInto('roles').values({ tenant_id: b.tenantId, label_key: 'x.y' }).execute()
			)
		).rejects.toThrow(/row-level security/);
	});

	it("can't reference another tenant's rows (composite foreign keys)", async () => {
		await expect(
			withTenant(app, a.tenantId, (trx) =>
				trx
					.insertInto('membership_roles')
					.values({ tenant_id: a.tenantId, membership_id: a.membershipId, role_id: b.roleId })
					.execute()
			)
		).rejects.toThrow(/foreign key/);
	});

	it('rejects a non-UUID tenant id before touching the database', async () => {
		await expect(withTenant(app, "' OR 1=1 --", async () => 1)).rejects.toThrow(/UUID/);
	});

	it('does not leak the tenant context to the next transaction on a pooled connection', async () => {
		// One connection, so the second query is guaranteed to reuse the first one's session.
		const single = connect(appUrl, 1);
		try {
			await withTenant(single, a.tenantId, async () => undefined);
			const { rows } = await sql<{
				t: string | null;
			}>`SELECT ra_current_tenant()::text AS t`.execute(single);
			expect(rows[0]?.t).toBeNull();
		} finally {
			await single.destroy();
		}
	});
});

describe('cross-tenant membership lookup', () => {
	it("lists only the user's own active memberships", async () => {
		const other = await seedUser(owner, 'other@example.org');
		await owner
			.insertInto('tenant_memberships')
			.values({ tenant_id: a.tenantId, user_id: other, display_name: 'Other' })
			.execute();
		const inactiveTenant = await seedTenant(owner, 'iso-inactive', null);
		await owner
			.insertInto('tenant_memberships')
			.values({
				tenant_id: inactiveTenant.tenantId,
				user_id: sharedUser,
				display_name: 'Former',
				status: 'inactive'
			})
			.execute();

		const memberships = await userMemberships(app, sharedUser);
		expect(memberships.map((m) => m.tenantSlug).sort()).toEqual(['iso-a', 'iso-b']);
		expect(memberships.find((m) => m.tenantSlug === 'iso-a')?.membershipId).toBe(a.membershipId);
	});
});
