// SPDX-License-Identifier: AGPL-3.0-or-later
// Creates the database roles and database (idempotent). Role passwords and the database name
// come from RA_DATABASE_URL / RA_DATABASE_OWNER_URL, so they are configured in one place.
// Needs a superuser connection in RA_BOOTSTRAP_ADMIN_URL (only for this step).
import { bootstrapDatabase } from '../src/lib/server/db/bootstrap';
import { loadDotEnv, requireEnv } from './env';

loadDotEnv();
const adminUrl = requireEnv('RA_BOOTSTRAP_ADMIN_URL');
const app = new URL(requireEnv('RA_DATABASE_URL'));
const owner = new URL(requireEnv('RA_DATABASE_OWNER_URL'));

if (app.username !== 'ra_app' || owner.username !== 'ra_owner') {
	console.error('RA_DATABASE_URL must use role ra_app and RA_DATABASE_OWNER_URL role ra_owner.');
	process.exit(1);
}
const database = decodeURIComponent(app.pathname.slice(1));
if (!database || database !== decodeURIComponent(owner.pathname.slice(1))) {
	console.error('RA_DATABASE_URL and RA_DATABASE_OWNER_URL must name the same database.');
	process.exit(1);
}

await bootstrapDatabase({
	adminUrl,
	database,
	ownerPassword: decodeURIComponent(owner.password),
	appPassword: decodeURIComponent(app.password)
});
console.log(`Roles ra_owner/ra_app and database "${database}" are ready.`);
