// SPDX-License-Identifier: AGPL-3.0-or-later
import { migrate } from '../src/lib/server/db/migrate';
import { loadDotEnv, requireEnv } from './env';

loadDotEnv();
const applied = await migrate(requireEnv('RA_DATABASE_OWNER_URL'), 'db/migrations');
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
