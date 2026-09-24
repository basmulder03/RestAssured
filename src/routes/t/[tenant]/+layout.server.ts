// SPDX-License-Identifier: AGPL-3.0-or-later
import { requireTenant } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const tenant = requireTenant(locals);
	return {
		tenant: {
			slug: tenant.slug,
			name: tenant.name,
			status: tenant.status,
			isTenantAdmin: tenant.isTenantAdmin,
			// For showing/hiding controls only; every action checks permissions server-side.
			permissions: [...tenant.permissions]
		}
	};
};
