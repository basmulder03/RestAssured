// SPDX-License-Identifier: AGPL-3.0-or-later
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './schema';

export type { DB };

export function createDb(connectionString: string, maxConnections = 10): Kysely<DB> {
	return new Kysely<DB>({
		dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: maxConnections }) })
	});
}
