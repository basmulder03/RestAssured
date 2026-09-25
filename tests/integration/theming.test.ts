// SPDX-License-Identifier: AGPL-3.0-or-later
// Club themes (ADR-0002): permission, validation, versioning, and the CSS cache.
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '$lib/domain/theme';
import type { DB } from '$lib/server/db/schema';
import { getTheme, saveTheme, tenantThemeCss } from '$lib/server/theming';
import { appUrl, connect } from './db';
import { helpers } from './helpers';

let app: Kysely<DB>;
beforeAll(() => {
	app = connect(appUrl);
});
afterAll(async () => {
	await app.destroy();
});

const { actorFor, club, manager, roleByKey } = helpers(() => app);

describe('club themes', () => {
	it('saves a valid theme, bumps the version, and serves the new CSS', async () => {
		const { admin, slug } = await club();
		const before = admin.tenant.themeVersion;
		expect(await tenantThemeCss(app, admin.tenant.id, before)).toContain(
			'--ra-color-primary:#1f4e79'
		);

		await saveTheme(app, admin, { ...DEFAULT_THEME, primary: '#8B0000', radius: 'lg' });
		const after = await actorFor(admin.userId, slug);
		expect(after.tenant.themeVersion).toBe(before + 1);
		const css = await tenantThemeCss(app, admin.tenant.id, after.tenant.themeVersion);
		expect(css).toContain('--ra-color-primary:#8b0000');
		expect(css).toContain('--ra-color-primary-contrast:#ffffff');
		expect(css).toContain('--ra-radius:12px');
		expect(await getTheme(app, after)).toMatchObject({ primary: '#8b0000', radius: 'lg' });
	});

	it('refuses unreadable link colours and anything that is not a typed value', async () => {
		const { admin } = await club();
		await expect(saveTheme(app, admin, { ...DEFAULT_THEME, primary: '#ffd700' })).rejects.toThrow(
			'theme.errors.link_contrast'
		);
		await expect(
			saveTheme(app, admin, { ...DEFAULT_THEME, primary: '#000;}body{display:none}' })
		).rejects.toThrow('theme.errors.color_invalid');
		// A light main colour is fine with a dark link colour.
		await saveTheme(app, admin, { ...DEFAULT_THEME, primary: '#ffd700', accent: '#1a1a1a' });
	});

	it('requires tenant:manage_theme and only changes the own club', async () => {
		const a = await club();
		const b = await club();
		const qm = await manager(a.admin, [await roleByKey(a.admin, 'roles.quartermaster')]);
		await expect(saveTheme(app, qm.actor, DEFAULT_THEME)).rejects.toThrow('errors.forbidden');
		await expect(getTheme(app, qm.actor)).rejects.toThrow('errors.forbidden');

		await saveTheme(app, a.admin, { ...DEFAULT_THEME, primary: '#004d00' });
		const bCss = await tenantThemeCss(app, b.tenantId, b.admin.tenant.themeVersion);
		expect(bCss).toContain('--ra-color-primary:#1f4e79');
	});
});
