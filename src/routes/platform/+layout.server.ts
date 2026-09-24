// SPDX-License-Identifier: AGPL-3.0-or-later
import { requirePlatformAdmin } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	requirePlatformAdmin(locals);
};
