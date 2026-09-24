// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Kysely } from 'kysely';
import { loadConfig, type Config } from './config';
import { createDb, type DB } from './db';
import { migrate } from './db/migrate';

type Runtime = { config: Config; db: Kysely<DB> };
let state: Runtime | undefined;

/** Called once from the server `init` hook: validates config, migrates, opens the pool. */
export async function initRuntime(env: Record<string, string | undefined>): Promise<Runtime> {
	if (state) return state;
	const config = loadConfig(env);
	if (config.migrateOnStart && config.databaseOwnerUrl) {
		// Migrations live next to the app (copied into the container image).
		const applied = await migrate(config.databaseOwnerUrl, 'db/migrations');
		if (applied.length) console.info(`Applied migrations: ${applied.join(', ')}`);
	}
	state = { config, db: createDb(config.databaseUrl) };
	return state;
}

export function runtime(): Runtime {
	if (!state)
		throw new Error('Runtime not initialised; initRuntime() runs in the server init hook.');
	return state;
}
