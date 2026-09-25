// SPDX-License-Identifier: AGPL-3.0-or-later
import { assetStats } from '$lib/server/assets';
import { requireTenant, requireUser } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const tenant = requireTenant(locals);
	const stats = tenant.permissions.has('assets:view')
		? await assetStats(runtime().db, { userId: user.id, tenant })
		: null;
	return { stats };
};
