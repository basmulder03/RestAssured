// SPDX-License-Identifier: AGPL-3.0-or-later
// Connection URLs for the integration test database. Uses the same roles and passwords as the
// dev environment (.env) so running tests never changes a developer's role passwords.
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { loadDotEnv } from '../../scripts/env';
import type { DB } from '../../src/lib/server/db/schema';

loadDotEnv();

export const TEST_DATABASE = 'restassured_test';

export const adminUrl =
	process.env.RA_BOOTSTRAP_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:54320/postgres';

function passwordFrom(envName: string, fallback: string): string {
	const value = process.env[envName];
	return value ? decodeURIComponent(new URL(value).password) : fallback;
}

export const ownerPassword = passwordFrom('RA_DATABASE_OWNER_URL', 'ra_owner_dev');
export const appPassword = passwordFrom('RA_DATABASE_URL', 'ra_app_dev');

function urlFor(user: string, password: string): string {
	const url = new URL(adminUrl);
	url.username = user;
	url.password = password;
	url.pathname = `/${TEST_DATABASE}`;
	return url.toString();
}

export const ownerUrl = urlFor('ra_owner', ownerPassword);
export const appUrl = urlFor('ra_app', appPassword);

export function connect(url: string, maxConnections = 4): Kysely<DB> {
	return new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ connectionString: url, max: maxConnections })
		})
	});
}
