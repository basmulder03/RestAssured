// SPDX-License-Identifier: AGPL-3.0-or-later
import { cpSync, mkdtempSync, appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMigrations, migrate } from '$lib/server/db/migrate';
import { ownerUrl } from './db';

const dirs: string[] = [];
function copyMigrations(): string {
	const dir = mkdtempSync(join(tmpdir(), 'ra-migrations-'));
	dirs.push(dir);
	cpSync('db/migrations', dir, { recursive: true });
	return dir;
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('migrate', () => {
	it('is idempotent', async () => {
		expect(await migrate(ownerUrl, 'db/migrations')).toEqual([]);
	});

	it('refuses to run when an applied migration was modified', async () => {
		const dir = copyMigrations();
		appendFileSync(join(dir, '0001_core_tenancy.sql'), '\n-- edited\n');
		await expect(migrate(ownerUrl, dir)).rejects.toThrow(/was modified/);
	});
});

describe('loadMigrations', () => {
	it('rejects badly named and duplicate files', async () => {
		const bad = copyMigrations();
		writeFileSync(join(bad, 'add-stuff.sql'), 'SELECT 1;');
		await expect(loadMigrations(bad)).rejects.toThrow(/NNNN_name\.sql/);

		const dup = copyMigrations();
		writeFileSync(join(dup, '0001_other.sql'), 'SELECT 1;');
		await expect(loadMigrations(dup)).rejects.toThrow(/Duplicate/);
	});
});
