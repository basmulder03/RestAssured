// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql, type Kysely, type Transaction } from 'kysely';
import type { DB } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` in a transaction scoped to one tenant. All tenant data access goes through here.
 * Queries inside must still filter on tenant_id explicitly; RLS is the safety net (ADR-0001).
 */
export async function withTenant<T>(
	db: Kysely<DB>,
	tenantId: string,
	fn: (trx: Transaction<DB>) => Promise<T>
): Promise<T> {
	if (!UUID.test(tenantId)) throw new Error('withTenant: tenantId must be a UUID');
	return db.transaction().execute(async (trx) => {
		// ADR-0001: is_local = true scopes the setting to this transaction, so a pooled
		// connection can never carry one tenant's context into another request.
		await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
		return fn(trx);
	});
}

export type UserMembership = {
	tenantId: string;
	tenantSlug: string;
	tenantName: string;
	membershipId: string;
};

/** A user's active memberships across tenants (tenant switcher, tenant resolution). */
export async function userMemberships(db: Kysely<DB>, userId: string): Promise<UserMembership[]> {
	if (!UUID.test(userId)) throw new Error('userMemberships: userId must be a UUID');
	const { rows } = await sql<{
		tenant_id: string;
		tenant_slug: string;
		tenant_name: string;
		membership_id: string;
	}>`SELECT * FROM ra_user_memberships(${userId})`.execute(db);
	return rows.map((r) => ({
		tenantId: r.tenant_id,
		tenantSlug: r.tenant_slug,
		tenantName: r.tenant_name,
		membershipId: r.membership_id
	}));
}
