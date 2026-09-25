// SPDX-License-Identifier: AGPL-3.0-or-later
import { ASSET_STATUSES, listAssets, type AssetFilters } from '$lib/server/assets';
import { requirePermission, requireUser } from '$lib/server/guards';
import { listCategories } from '$lib/server/inventory';
import { runtime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

// Filters are plain query parameters so the list works (and can be bookmarked) without JS.
export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const tenant = requirePermission(locals, 'assets:view');
	const actor = { userId: user.id, tenant };
	const status = url.searchParams.get('status') ?? 'current';
	const filters: AssetFilters = {
		q: url.searchParams.get('q') ?? '',
		categoryId: url.searchParams.get('category') ?? '',
		status:
			status === 'all' || (ASSET_STATUSES as readonly string[]).includes(status)
				? (status as AssetFilters['status'])
				: 'current'
	};
	const [assets, categories] = await Promise.all([
		listAssets(runtime().db, actor, filters),
		listCategories(runtime().db, actor)
	]);
	return { assets, categories, filters };
};
