// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Kysely } from 'kysely';
import type { Permission } from '$lib/domain/permissions';
import type { DB } from '$lib/server/db/schema';
import { userMemberships, withTenant } from '$lib/server/db/tenant';
import { resolvePermissions } from '$lib/server/rbac';

export type TenantContext = {
	id: string;
	slug: string;
	name: string;
	status: string;
	defaultLocale: string;
	currency: string;
	membershipId: string;
	permissions: ReadonlySet<Permission>;
	isTenantAdmin: boolean;
	/** Bumped on every theme change; keys the theme CSS cache (ADR-0002). */
	themeVersion: number;
};

/**
 * ADR-0001 §3: the tenant comes from the URL and must match an active membership of the
 * signed-in user. Returns null (→ 404, never 403) when it doesn't, including when the session
 * is scoped to a different tenant (ADR-0004 §4).
 */
export async function resolveTenantContext(
	db: Kysely<DB>,
	userId: string,
	slug: string,
	scopedTenantId: string | null
): Promise<TenantContext | null> {
	const membership = (await userMemberships(db, userId)).find((m) => m.tenantSlug === slug);
	if (!membership) return null;
	if (scopedTenantId && scopedTenantId !== membership.tenantId) return null;

	return withTenant(db, membership.tenantId, async (trx) => {
		const tenant = await trx
			.selectFrom('tenants as t')
			.leftJoin('theme_settings as ts', 'ts.tenant_id', 't.id')
			.select([
				't.id',
				't.slug',
				't.name',
				't.status',
				't.default_locale',
				't.currency',
				'ts.version'
			])
			.where('t.id', '=', membership.tenantId)
			.executeTakeFirstOrThrow();
		const { permissions, isTenantAdmin } = await resolvePermissions(
			trx,
			tenant.id,
			membership.membershipId
		);
		return {
			id: tenant.id,
			slug: tenant.slug,
			name: tenant.name,
			status: tenant.status,
			defaultLocale: tenant.default_locale,
			currency: tenant.currency,
			membershipId: membership.membershipId,
			permissions,
			isTenantAdmin,
			themeVersion: tenant.version ?? 0
		};
	});
}
