// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Handle, ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { resolveLocale } from '$lib/i18n';
import { sessionCookieName, validateSession } from '$lib/server/auth/sessions';
import { clearSessionCookie } from '$lib/server/guards';
import { initRuntime, runtime } from '$lib/server/runtime';
import { resolveTenantContext } from '$lib/server/tenancy';

export const init: ServerInit = async () => {
	await initRuntime(env);
};

const SECURITY_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	// Camera stays available to our own origin for scanning asset labels (ADR-0015).
	'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
	'Cross-Origin-Opener-Policy': 'same-origin'
};

const TENANT_PATH = /^\/t\/([^/]+)/;

export const handle: Handle = async ({ event, resolve }) => {
	const { db } = runtime();
	const { cookies, locals, url } = event;

	// Session → user (ADR-0004). The session identifies the user only; the URL names the club.
	const secret = cookies.get(sessionCookieName(url.protocol === 'https:'));
	const session = secret ? await validateSession(db, secret) : null;
	if (secret && !session) clearSessionCookie(cookies, url);
	locals.user = session?.user ?? null;
	locals.session = session && secret ? { secret, scopedTenantId: session.scopedTenantId } : null;
	locals.tenant = null;

	const tenantSlug = TENANT_PATH.exec(url.pathname)?.[1];
	const needsUser = tenantSlug !== undefined || url.pathname.startsWith('/platform');
	if (needsUser && !locals.user) {
		const next = encodeURIComponent(url.pathname + url.search);
		return new Response(null, { status: 303, headers: { Location: `/login?next=${next}` } });
	}
	if (tenantSlug && locals.user) {
		// ADR-0001 §3: membership is verified on every request. Null here becomes a 404.
		locals.tenant = await resolveTenantContext(
			db,
			locals.user.id,
			decodeURIComponent(tenantSlug),
			session?.scopedTenantId ?? null
		);
		if (locals.tenant && locals.user.lastTenantId !== locals.tenant.id) {
			await db
				.updateTable('users')
				.set({ last_tenant_id: locals.tenant.id })
				.where('id', '=', locals.user.id)
				.execute();
		}
	}

	locals.locale = resolveLocale({
		userPreference: locals.user?.preferredLocale,
		tenantDefault: locals.tenant?.defaultLocale,
		acceptLanguage: event.request.headers.get('accept-language')
	});

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%ra.lang%', locals.locale)
	});
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	// Signed-in pages contain club data: keep them out of shared and back-forward caches.
	if (locals.user && !response.headers.has('Cache-Control')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
