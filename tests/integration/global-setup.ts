// SPDX-License-Identifier: AGPL-3.0-or-later
// Fresh test database per run: drop → bootstrap roles/database → migrate.
import { bootstrapDatabase, dropDatabase } from '../../src/lib/server/db/bootstrap';
import { migrate } from '../../src/lib/server/db/migrate';
import { adminUrl, appPassword, ownerPassword, ownerUrl, TEST_DATABASE } from './db';

export default async function setup(): Promise<void> {
	await dropDatabase(adminUrl, TEST_DATABASE);
	await bootstrapDatabase({ adminUrl, database: TEST_DATABASE, ownerPassword, appPassword });
	await migrate(ownerUrl, 'db/migrations');
}
