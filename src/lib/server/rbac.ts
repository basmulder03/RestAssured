// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Kysely } from 'kysely';
import { PERMISSIONS, type Permission } from '../domain/permissions';
import type { DB } from './db/schema';

const ALL = new Set<Permission>(PERMISSIONS.map((p) => p.code));
const KNOWN = ALL as ReadonlySet<string>;

export type EffectivePermissions = { permissions: ReadonlySet<Permission>; isTenantAdmin: boolean };

/**
 * ADR-0003: union of the membership's roles; the Tenant Admin system role implies everything.
 * Must run in a transaction scoped to `tenantId`.
 */
export async function resolvePermissions(
	trx: Kysely<DB>,
	tenantId: string,
	membershipId: string
): Promise<EffectivePermissions> {
	const rows = await trx
		.selectFrom('membership_roles as mr')
		.innerJoin('roles as r', (j) =>
			j.onRef('r.tenant_id', '=', 'mr.tenant_id').onRef('r.id', '=', 'mr.role_id')
		)
		.leftJoin('role_permissions as rp', (j) =>
			j.onRef('rp.tenant_id', '=', 'r.tenant_id').onRef('rp.role_id', '=', 'r.id')
		)
		.select(['r.is_system', 'rp.permission_code'])
		.where('mr.tenant_id', '=', tenantId)
		.where('mr.membership_id', '=', membershipId)
		.execute();

	if (rows.some((r) => r.is_system)) return { permissions: ALL, isTenantAdmin: true };
	const granted = new Set<Permission>();
	for (const r of rows) {
		if (r.permission_code && KNOWN.has(r.permission_code))
			granted.add(r.permission_code as Permission);
	}
	return { permissions: granted, isTenantAdmin: false };
}
