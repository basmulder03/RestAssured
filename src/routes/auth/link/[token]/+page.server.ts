// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0004: opening a link (GET) never consumes it, so link previews and mail scanners can't
// burn it. The person confirms with a POST.
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import {
	acceptInvite,
	consumeMagicLogin,
	consumePasswordReset,
	describeInvite,
	type SignedIn
} from '$lib/server/auth/links';
import { LIMITS, withinRateLimit } from '$lib/server/auth/rate-limit';
import { findUsableToken } from '$lib/server/auth/tokens';
import { DomainError } from '$lib/server/errors';
import { setSessionCookie } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const PRIVATE_HEADERS = { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	setHeaders(PRIVATE_HEADERS);
	const { db } = runtime();
	const token = await findUsableToken(db, params.token, { lock: false });
	if (!token) return { kind: 'invalid' as const };
	if (token.purpose === 'invite') {
		const invite = await describeInvite(db, params.token);
		if (!invite) return { kind: 'invalid' as const };
		return { kind: 'invite' as const, invite, signedInAs: locals.user?.email ?? null };
	}
	return { kind: token.purpose as 'magic_login' | 'password_reset' };
};

async function run(
	event: RequestEvent,
	consume: () => Promise<SignedIn & { newAccount?: boolean }>
) {
	event.setHeaders(PRIVATE_HEADERS);
	const { db } = runtime();
	if (!(await withinRateLimit(db, 'link:ip', event.getClientAddress(), LIMITS.linkPerIp))) {
		return fail(429, { error: 'errors.rate_limited' });
	}
	let result: SignedIn & { newAccount?: boolean };
	try {
		result = await consume();
	} catch (err) {
		if (err instanceof DomainError) return fail(400, { error: err.code });
		throw err;
	}
	setSessionCookie(event.cookies, event.url, result.session.secret, result.session.expiresAt);
	redirect(303, result.newAccount ? '/account?welcome' : result.redirectTo);
}

export const actions: Actions = {
	login: (event) => run(event, () => consumeMagicLogin(runtime().db, event.params.token)),

	reset: async (event) => {
		const form = await event.request.formData();
		const password = String(form.get('new_password') ?? '');
		if (password !== String(form.get('confirm_password') ?? '')) {
			return fail(400, { error: 'errors.password.mismatch' });
		}
		return run(event, () => consumePasswordReset(runtime().db, event.params.token, password));
	},

	invite: (event) =>
		run(event, () => acceptInvite(runtime().db, event.params.token, event.locals.user?.id ?? null))
};
