// SPDX-License-Identifier: AGPL-3.0-or-later
// Operator commands. Development: `pnpm cli <command>`. Production: `node build/cli.js <command>`.
import { parseArgs } from 'node:util';
import { bootstrapDatabase } from '../src/lib/server/db/bootstrap';
import { createDb } from '../src/lib/server/db/index';
import { migrate } from '../src/lib/server/db/migrate';
import { createSuperAdmin } from '../src/lib/server/platform';
import { loadDotEnv } from './env';

const USAGE = `Usage: cli <command>

  bootstrap                       Create roles ra_owner/ra_app and the database (needs
                                  RA_BOOTSTRAP_ADMIN_URL, a superuser connection)
  migrate                         Apply pending migrations (RA_DATABASE_OWNER_URL)
  create-super-admin --email <e>  Grant Super Admin and print a one-time login link
                                  (link base from --origin or ORIGIN)`;

function env(name: string): string {
	const value = process.env[name];
	if (!value) fail(`${name} is not set.`);
	return value;
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

async function bootstrap(): Promise<void> {
	const app = new URL(env('RA_DATABASE_URL'));
	const owner = new URL(env('RA_DATABASE_OWNER_URL'));
	if (app.username !== 'ra_app' || owner.username !== 'ra_owner') {
		fail('RA_DATABASE_URL must use role ra_app and RA_DATABASE_OWNER_URL role ra_owner.');
	}
	const database = decodeURIComponent(app.pathname.slice(1));
	if (!database || database !== decodeURIComponent(owner.pathname.slice(1))) {
		fail('RA_DATABASE_URL and RA_DATABASE_OWNER_URL must name the same database.');
	}
	// Passwords and database name come from the app's own URLs: one place to configure them.
	await bootstrapDatabase({
		adminUrl: env('RA_BOOTSTRAP_ADMIN_URL'),
		database,
		ownerPassword: decodeURIComponent(owner.password),
		appPassword: decodeURIComponent(app.password)
	});
	console.log(`Roles ra_owner/ra_app and database "${database}" are ready.`);
}

async function runMigrations(): Promise<void> {
	const applied = await migrate(env('RA_DATABASE_OWNER_URL'), 'db/migrations');
	console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
}

async function superAdmin(args: string[]): Promise<void> {
	const { values } = parseArgs({
		args,
		options: { email: { type: 'string' }, origin: { type: 'string' } }
	});
	if (!values.email) fail('--email is required.');
	const origin = values.origin ?? process.env.ORIGIN;
	if (!origin) fail('Set ORIGIN (the public URL of this installation) or pass --origin.');

	const db = createDb(env('RA_DATABASE_URL'), 1);
	try {
		const { login } = await createSuperAdmin(db, values.email);
		console.log(`${values.email} is now a Super Admin.\n`);
		console.log(`One-time login link (expires ${login.expiresAt.toISOString()}):\n`);
		console.log(`  ${new URL(`/auth/link/${login.secret}`, origin).href}\n`);
		console.log('Treat it like a password. Run this command again for a new link.');
	} finally {
		await db.destroy();
	}
}

loadDotEnv();
const [command, ...rest] = process.argv.slice(2);
switch (command) {
	case 'bootstrap':
		await bootstrap();
		break;
	case 'migrate':
		await runMigrations();
		break;
	case 'create-super-admin':
		await superAdmin(rest);
		break;
	default:
		fail(USAGE);
}
