// SPDX-License-Identifier: AGPL-3.0-or-later
// Local development PostgreSQL in a container. Works with Docker Engine and Podman
// (RA_CONTAINER_CLI=podman). Not for production; see the self-hosting docs.
// Usage: pnpm db:up | pnpm db:down | pnpm db:reset
import { execFileSync, spawnSync } from 'node:child_process';

const cli = process.env.RA_CONTAINER_CLI ?? 'docker';
const name = 'restassured-dev-db';
const volume = 'restassured-dev-pgdata';
const image = 'postgres:18-alpine';
// Unusual port so it doesn't collide with a Postgres already running on the machine.
const port = '127.0.0.1:54320:5432';

function run(args: string[], opts: { quiet?: boolean } = {}): boolean {
	const r = spawnSync(cli, args, { stdio: opts.quiet ? 'ignore' : 'inherit' });
	return r.status === 0;
}

function isRunning(): boolean {
	try {
		return execFileSync(cli, ['inspect', '-f', '{{.State.Running}}', name], {
			stdio: ['ignore', 'pipe', 'ignore']
		})
			.toString()
			.trim()
			.startsWith('true');
	} catch {
		return false;
	}
}

async function up(): Promise<void> {
	if (!isRunning()) {
		run(['rm', '-f', name], { quiet: true });
		const ok = run([
			'run',
			'-d',
			'--name',
			name,
			'-e',
			'POSTGRES_PASSWORD=postgres',
			'-p',
			port,
			'-v',
			`${volume}:/var/lib/postgresql`,
			image
		]);
		if (!ok) process.exit(1);
	}
	for (let i = 0; i < 60; i++) {
		if (run(['exec', name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1'], { quiet: true })) {
			console.log(`PostgreSQL is ready on ${port.split(':').slice(0, 2).join(':')}.`);
			return;
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	console.error('PostgreSQL did not become ready in time.');
	process.exit(1);
}

function down(): void {
	run(['rm', '-f', name], { quiet: true });
	console.log('Stopped (data volume kept; use `pnpm db:reset` to delete it).');
}

const command = process.argv[2];
if (command === 'up') await up();
else if (command === 'down') down();
else if (command === 'reset') {
	down();
	run(['volume', 'rm', '-f', volume], { quiet: true });
	await up();
} else {
	console.error('Usage: dev-db.ts up|down|reset');
	process.exit(1);
}
