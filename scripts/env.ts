// SPDX-License-Identifier: AGPL-3.0-or-later
// Loads .env for CLI scripts (SvelteKit does this itself for the app). Existing env wins.
import { existsSync, readFileSync } from 'node:fs';

export function loadDotEnv(path = '.env'): void {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
		if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
	}
}

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`${name} is not set (see .env.example).`);
		process.exit(1);
	}
	return value;
}
