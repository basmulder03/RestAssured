// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { loadConfig } from '$lib/server/config';

const base = {
	RA_DATABASE_URL: 'postgres://ra_app:x@localhost/restassured',
	RA_DATABASE_OWNER_URL: 'postgres://ra_owner:x@localhost/restassured'
};

describe('loadConfig', () => {
	it('applies defaults', () => {
		const c = loadConfig(base);
		expect(c.migrateOnStart).toBe(true);
		expect(c.defaultLocale).toBe('nl');
		expect(c.sourceUrl).toMatch(/^https:\/\//);
	});

	it('rejects a missing database URL and lists the problem', () => {
		expect(() => loadConfig({})).toThrow(/RA_DATABASE_URL/);
	});

	it('requires the owner URL only when migrating on start', () => {
		const env = { RA_DATABASE_URL: base.RA_DATABASE_URL };
		expect(() => loadConfig(env)).toThrow(/RA_DATABASE_OWNER_URL/);
		expect(loadConfig({ ...env, RA_MIGRATE_ON_START: 'false' }).migrateOnStart).toBe(false);
	});

	it('rejects unsupported locales and non-boolean flags', () => {
		expect(() => loadConfig({ ...base, RA_DEFAULT_LOCALE: 'de' })).toThrow(/RA_DEFAULT_LOCALE/);
		expect(() => loadConfig({ ...base, RA_MIGRATE_ON_START: 'yes' })).toThrow(
			/RA_MIGRATE_ON_START/
		);
	});
});
