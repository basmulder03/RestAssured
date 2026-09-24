// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail } from '@sveltejs/kit';
import { isLocale } from '$lib/i18n';
import { changePassword } from '$lib/server/auth/login';
import { DomainError } from '$lib/server/errors';
import { requireUser, setSessionCookie } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals, url);
	return {
		email: user.email,
		hasPassword: user.hasPassword,
		preferredLocale: user.preferredLocale,
		scoped: locals.session?.scopedTenantId != null,
		welcome: url.searchParams.has('welcome')
	};
};

export const actions: Actions = {
	password: async ({ locals, request, cookies, url }) => {
		const user = requireUser(locals, url);
		const form = await request.formData();
		const newPassword = String(form.get('new_password') ?? '');
		if (newPassword !== String(form.get('confirm_password') ?? '')) {
			return fail(400, { passwordError: 'errors.password.mismatch' });
		}
		try {
			const session = await changePassword(runtime().db, {
				userId: user.id,
				scopedTenantId: locals.session?.scopedTenantId ?? null,
				currentPassword: user.hasPassword ? String(form.get('current_password') ?? '') : null,
				newPassword
			});
			setSessionCookie(cookies, url, session.secret, session.expiresAt);
		} catch (err) {
			if (err instanceof DomainError) return fail(400, { passwordError: err.code });
			throw err;
		}
		return { passwordSaved: true };
	},

	language: async ({ locals, request, url }) => {
		const user = requireUser(locals, url);
		const value = (await request.formData()).get('locale');
		const locale = value === '' ? null : value;
		if (locale !== null && !isLocale(locale)) return fail(400, { languageError: 'errors.invalid' });
		await runtime()
			.db.updateTable('users')
			.set({ preferred_locale: locale })
			.where('id', '=', user.id)
			.execute();
		return { languageSaved: true };
	}
};
