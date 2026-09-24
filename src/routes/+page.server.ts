// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from '@sveltejs/kit';
import { userMemberships } from '$lib/server/db/tenant';
import { runtime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { signedIn: false as const };

	const scoped = locals.session?.scopedTenantId ?? null;
	const clubs = (await userMemberships(runtime().db, locals.user.id)).filter(
		(m) => !scoped || m.tenantId === scoped
	);
	const last = clubs.find((m) => m.tenantId === locals.user?.lastTenantId);
	const target = last ?? (clubs.length === 1 ? clubs[0] : undefined);
	if (target) redirect(303, `/t/${target.tenantSlug}`);

	return {
		signedIn: true as const,
		clubs: clubs.map((m) => ({ slug: m.tenantSlug, name: m.tenantName }))
	};
};
