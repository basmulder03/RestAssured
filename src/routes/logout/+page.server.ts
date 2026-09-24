// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from '@sveltejs/kit';
import { revokeSession } from '$lib/server/auth/sessions';
import { clearSessionCookie } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

// Signing out changes state, so it's POST-only (a GET link could be triggered by a third party).
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, cookies, url }) => {
		if (locals.session) await revokeSession(runtime().db, locals.session.secret);
		clearSessionCookie(cookies, url);
		redirect(303, '/');
	}
};
