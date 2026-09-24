// SPDX-License-Identifier: AGPL-3.0-or-later
// Route guards. Call them in every load *and* every form action: SvelteKit runs actions before
// layout loads, so a layout-level check alone doesn't protect actions (ADR-0003).
import { error, redirect, type Cookies } from '@sveltejs/kit';
import type { Permission } from '../domain/permissions';
import { sessionCookieName } from './auth/sessions';
import type { TenantContext } from './tenancy';

export function requireUser(locals: App.Locals, url: URL) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return locals.user;
}

/** 404 rather than 403 for clubs the user can't see, so club slugs can't be probed (ADR-0001). */
export function requireTenant(locals: App.Locals): TenantContext {
	if (!locals.tenant) error(404, 'errors.not_found');
	return locals.tenant;
}

export function requirePermission(locals: App.Locals, permission: Permission): TenantContext {
	const tenant = requireTenant(locals);
	if (!tenant.permissions.has(permission)) error(403, 'errors.forbidden');
	return tenant;
}

/** Club-scoped sessions (ADR-0004 §4) never reach the platform panel. */
export function requirePlatformAdmin(locals: App.Locals) {
	if (
		!locals.user ||
		locals.user.platformRole !== 'super_admin' ||
		locals.session?.scopedTenantId
	) {
		error(404, 'errors.not_found');
	}
	return locals.user;
}

/** Only same-site relative paths; anything else (//evil, https://…, /\evil) becomes `/`. */
export function safeRedirectPath(next: string | null | undefined): string {
	return next && /^\/(?![/\\])/.test(next) ? next : '/';
}

export function setSessionCookie(cookies: Cookies, url: URL, secret: string, expiresAt: Date) {
	const secure = url.protocol === 'https:';
	cookies.set(sessionCookieName(secure), secret, {
		path: '/',
		httpOnly: true,
		secure,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
	const secure = url.protocol === 'https:';
	cookies.delete(sessionCookieName(secure), { path: '/', secure });
}
