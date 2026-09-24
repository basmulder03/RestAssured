// SPDX-License-Identifier: AGPL-3.0-or-later
import { userMemberships } from '$lib/server/db/tenant';
import { runtime } from '$lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { config, db } = runtime();
	const user = locals.user;
	const scopedTenantId = locals.session?.scopedTenantId ?? null;
	// The switcher only lists clubs this session may open (ADR-0004 §4).
	const clubs = user
		? (await userMemberships(db, user.id))
				.filter((m) => !scopedTenantId || m.tenantId === scopedTenantId)
				.map((m) => ({ slug: m.tenantSlug, name: m.tenantName }))
		: [];
	return {
		locale: locals.locale,
		sourceUrl: config.sourceUrl,
		user: user && {
			email: user.email,
			isPlatformAdmin: user.platformRole === 'super_admin' && !scopedTenantId
		},
		clubs,
		currentClub: locals.tenant && { slug: locals.tenant.slug, name: locals.tenant.name }
	};
};
