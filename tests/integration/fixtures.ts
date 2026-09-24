// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Kysely } from 'kysely';
import type { DB } from '../../src/lib/server/db/schema';

export type TenantFixture = {
	tenantId: string;
	membershipId: string;
	roleId: string;
};

/**
 * Seeds one tenant with a row in every tenant-scoped table. Must run as the owner (BYPASSRLS).
 * When a new tenant table is added, extend this so the isolation suite covers it.
 */
export async function seedTenant(
	owner: Kysely<DB>,
	slug: string,
	userId: string | null
): Promise<TenantFixture> {
	const { id: tenantId } = await owner
		.insertInto('tenants')
		.values({ slug, name: `Club ${slug}` })
		.returning('id')
		.executeTakeFirstOrThrow();
	const { id: membershipId } = await owner
		.insertInto('tenant_memberships')
		.values({ tenant_id: tenantId, user_id: userId, display_name: `Member of ${slug}` })
		.returning('id')
		.executeTakeFirstOrThrow();
	const { id: roleId } = await owner
		.insertInto('roles')
		.values({ tenant_id: tenantId, label_key: 'roles.quartermaster' })
		.returning('id')
		.executeTakeFirstOrThrow();
	await owner
		.insertInto('role_permissions')
		.values({ tenant_id: tenantId, role_id: roleId, permission_code: 'assets:view' })
		.execute();
	await owner
		.insertInto('membership_roles')
		.values({ tenant_id: tenantId, membership_id: membershipId, role_id: roleId })
		.execute();
	await owner.insertInto('theme_settings').values({ tenant_id: tenantId }).execute();
	await owner
		.insertInto('audit_log')
		.values({ tenant_id: tenantId, action: 'tenant.created', subject_type: 'tenant' })
		.execute();
	return { tenantId, membershipId, roleId };
}

export async function seedUser(owner: Kysely<DB>, email: string): Promise<string> {
	const { id } = await owner
		.insertInto('users')
		.values({ email })
		.returning('id')
		.executeTakeFirstOrThrow();
	return id;
}
