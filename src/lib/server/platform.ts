// SPDX-License-Identifier: AGPL-3.0-or-later
// Platform (Super Admin) operations (ADR-0001 §4, ADR-0003, ADR-0018).
import { sql, type Kysely } from 'kysely';
import * as v from 'valibot';
import type { Permission } from '$lib/domain/permissions';
import { auditPlatform, auditTenant } from '$lib/server/audit';
import { issueToken } from '$lib/server/auth/tokens';
import type { DB } from '$lib/server/db/schema';
import { setTenant } from '$lib/server/db/tenant';
import { DomainError } from '$lib/server/errors';

/** Editable role templates seeded into every new club (docs/SYSTEM_SPEC.md §3.3). */
export const ROLE_TEMPLATES: { labelKey: string; permissions: Permission[] }[] = [
	{
		labelKey: 'roles.board_member',
		permissions: [
			'assets:view',
			'assets:view_financials',
			'assignments:view',
			'members:view',
			'members:manage',
			'members:invite',
			'members:export_data',
			'roles:view',
			'financials:read_forecasts',
			'financials:configure_forecasts',
			'audit:view',
			'data:export'
		]
	},
	{
		labelKey: 'roles.quartermaster',
		permissions: [
			'assets:view',
			'assets:create',
			'assets:edit',
			'assets:delete',
			'assets:view_financials',
			'assignments:view',
			'assignments:manage',
			'members:view',
			'financials:read_forecasts',
			'data:import',
			'data:export'
		]
	},
	{
		labelKey: 'roles.instrument_manager',
		permissions: [
			'assets:view',
			'assets:create',
			'assets:edit',
			'assignments:view',
			'assignments:manage',
			'members:view'
		]
	},
	{
		labelKey: 'roles.viewer',
		permissions: ['assets:view', 'assignments:view', 'members:view']
	}
];

export const TENANT_ADMIN_ROLE_KEY = 'roles.tenant_admin';

// Every message is an i18n key (ADR-0007).
const email = v.pipe(
	v.string('errors.invalid'),
	v.trim(),
	v.toLowerCase(),
	v.email('errors.email_invalid'),
	v.maxLength(254, 'errors.email_invalid')
);
const requiredText = v.pipe(
	v.string('errors.invalid'),
	v.trim(),
	v.minLength(1, 'errors.required'),
	v.maxLength(200, 'errors.too_long')
);

export const ProvisionTenantSchema = v.object({
	slug: v.pipe(
		v.string('errors.invalid'),
		v.trim(),
		v.toLowerCase(),
		v.regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'platform.errors.slug_invalid')
	),
	name: requiredText,
	defaultLocale: v.picklist(['nl', 'en'], 'errors.invalid'),
	adminName: requiredText,
	adminEmail: email
});
export type ProvisionTenantInput = v.InferOutput<typeof ProvisionTenantSchema>;

/**
 * Creates a club with its Tenant Admin role, role templates, default theme, and a first admin
 * (a membership with an invite link; the account is created when the invite is accepted).
 */
export async function provisionTenant(
	db: Kysely<DB>,
	input: ProvisionTenantInput,
	actorUserId: string | null
): Promise<{ tenantId: string; invite: { secret: string; expiresAt: Date } }> {
	return db.transaction().execute(async (trx) => {
		const taken = await trx
			.selectFrom('tenants')
			.select('id')
			.where('slug', '=', input.slug)
			.executeTakeFirst();
		if (taken) throw new DomainError('platform.errors.slug_taken', { slug: input.slug });

		const { id: tenantId } = await trx
			.insertInto('tenants')
			.values({ slug: input.slug, name: input.name, default_locale: input.defaultLocale })
			.returning('id')
			.executeTakeFirstOrThrow();
		await setTenant(trx, tenantId);

		await trx.insertInto('theme_settings').values({ tenant_id: tenantId }).execute();
		await sql`SELECT ra_seed_default_categories()`.execute(trx);
		const { id: adminRoleId } = await trx
			.insertInto('roles')
			.values({ tenant_id: tenantId, label_key: TENANT_ADMIN_ROLE_KEY, is_system: true })
			.returning('id')
			.executeTakeFirstOrThrow();
		for (const template of ROLE_TEMPLATES) {
			const { id: roleId } = await trx
				.insertInto('roles')
				.values({ tenant_id: tenantId, label_key: template.labelKey })
				.returning('id')
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('role_permissions')
				.values(
					template.permissions.map((code) => ({
						tenant_id: tenantId,
						role_id: roleId,
						permission_code: code
					}))
				)
				.execute();
		}

		const { id: membershipId } = await trx
			.insertInto('tenant_memberships')
			.values({ tenant_id: tenantId, display_name: input.adminName, email: input.adminEmail })
			.returning('id')
			.executeTakeFirstOrThrow();
		await trx
			.insertInto('membership_roles')
			.values({ tenant_id: tenantId, membership_id: membershipId, role_id: adminRoleId })
			.execute();

		const invite = await issueToken(trx, {
			purpose: 'invite',
			membership: { tenantId, membershipId },
			issuedBy: actorUserId,
			issuedInTenantId: tenantId
		});
		await auditTenant(trx, tenantId, null, {
			action: 'tenant.provisioned',
			subjectType: 'tenant',
			subjectId: tenantId
		});
		await auditPlatform(trx, actorUserId, {
			action: 'tenant.provisioned',
			subjectType: 'tenant',
			subjectId: tenantId,
			changedFields: { slug: input.slug }
		});
		return { tenantId, invite };
	});
}

/**
 * ADR-0010 bootstrap: makes `email` a Super Admin (creating the account if needed) and returns a
 * one-time login link secret. There are no default passwords.
 */
export async function createSuperAdmin(
	db: Kysely<DB>,
	rawEmail: string
): Promise<{ userId: string; login: { secret: string; expiresAt: Date } }> {
	const address = v.parse(email, rawEmail);
	return db.transaction().execute(async (trx) => {
		const existing = await trx
			.selectFrom('users')
			.select('id')
			.where(sql<string>`lower(email)`, '=', address)
			.where('erased_at', 'is', null)
			.executeTakeFirst();
		const userId = existing
			? existing.id
			: (
					await trx
						.insertInto('users')
						.values({ email: address })
						.returning('id')
						.executeTakeFirstOrThrow()
				).id;
		await trx
			.updateTable('users')
			.set({ platform_role: 'super_admin', updated_at: sql<Date>`now()` })
			.where('id', '=', userId)
			.execute();
		const login = await issueToken(trx, { purpose: 'magic_login', userId });
		await auditPlatform(trx, null, {
			action: 'platform.super_admin_granted',
			subjectType: 'user',
			subjectId: userId
		});
		return { userId, login };
	});
}

export async function listTenants(db: Kysely<DB>) {
	return db
		.selectFrom('tenants')
		.select(['id', 'slug', 'name', 'status', 'default_locale', 'created_at'])
		.orderBy('name')
		.execute();
}
