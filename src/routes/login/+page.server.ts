// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, redirect } from '@sveltejs/kit';
import { loginWithPassword } from '$lib/server/auth/login';
import { DomainError } from '$lib/server/errors';
import { safeRedirectPath, setSessionCookie } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirectPath(url.searchParams.get('next')));
	return { next: safeRedirectPath(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const next = safeRedirectPath(String(form.get('next') ?? ''));
		try {
			const { session } = await loginWithPassword(runtime().db, {
				email,
				password,
				clientAddress: getClientAddress()
			});
			setSessionCookie(cookies, url, session.secret, session.expiresAt);
		} catch (err) {
			if (err instanceof DomainError) return fail(400, { email, error: err.code });
			throw err;
		}
		redirect(303, next);
	}
};
