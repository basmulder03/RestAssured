// SPDX-License-Identifier: AGPL-3.0-or-later
import { requirePlatformAdmin } from '$lib/server/guards';
import { listTenants } from '$lib/server/platform';
import { runtime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePlatformAdmin(locals);
	const tenants = await listTenants(runtime().db);
	return {
		tenants: tenants.map((t) => ({
			slug: t.slug,
			name: t.name,
			status: t.status,
			createdAt: t.created_at.toISOString()
		}))
	};
};
