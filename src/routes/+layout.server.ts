// SPDX-License-Identifier: AGPL-3.0-or-later
import { runtime } from '$lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	locale: locals.locale,
	sourceUrl: runtime().config.sourceUrl
});
