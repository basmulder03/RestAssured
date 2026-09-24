// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Handle, ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { resolveLocale } from '$lib/i18n';
import { initRuntime } from '$lib/server/runtime';

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

export const handle: Handle = async ({ event, resolve }) => {
	// Tenant and user preferences join this once tenancy and auth land (ADR-0007).
	const locale = resolveLocale({ acceptLanguage: event.request.headers.get('accept-language') });
	event.locals.locale = locale;

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%ra.lang%', locale)
	});
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
