// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { PERMISSIONS } from '../../domain/permissions';

export type Migration = { version: string; file: string; sql: string; checksum: string };

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

/** Reads `NNNN_name.sql` files from `dir`, sorted by version. Rejects duplicates and stray files. */
export async function loadMigrations(dir: string): Promise<Migration[]> {
	const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
	const seen = new Set<string>();
	const migrations: Migration[] = [];
	for (const file of files) {
		const version = FILE_PATTERN.exec(file)?.[1];
		if (!version) throw new Error(`Migration file name must match NNNN_name.sql: ${file}`);
		if (seen.has(version)) throw new Error(`Duplicate migration version ${version}`);
		seen.add(version);
		const sql = await readFile(join(dir, file), 'utf8');
		migrations.push({ version, file, sql, checksum: sha256(sql) });
	}
	return migrations;
}

/**
 * Applies pending migrations as the owner role, then syncs the permission catalogue.
 * Safe to run from several instances at once (advisory lock). Forward-only: an applied
 * migration whose file changed is an error, never silently re-run.
 * @returns the files that were applied.
 */
export async function migrate(ownerUrl: string, dir: string): Promise<string[]> {
	const migrations = await loadMigrations(dir);
	const client = new pg.Client({ connectionString: ownerUrl });
	await client.connect();
	try {
		await client.query(`SELECT pg_advisory_lock(hashtextextended('restassured:migrate', 0))`);
		await client.query(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				version    text PRIMARY KEY,
				file       text NOT NULL,
				checksum   text NOT NULL,
				applied_at timestamptz NOT NULL DEFAULT now()
			)`);
		const applied = new Map<string, string>(
			(
				await client.query<{ version: string; checksum: string }>(
					'SELECT version, checksum FROM schema_migrations'
				)
			).rows.map((r) => [r.version, r.checksum])
		);

		const done: string[] = [];
		for (const m of migrations) {
			const checksum = applied.get(m.version);
			if (checksum !== undefined) {
				if (checksum !== m.checksum) {
					throw new Error(`Applied migration ${m.file} was modified; add a new migration instead.`);
				}
				continue;
			}
			await client.query('BEGIN');
			try {
				await client.query(m.sql);
				await client.query(
					'INSERT INTO schema_migrations (version, file, checksum) VALUES ($1, $2, $3)',
					[m.version, m.file, m.checksum]
				);
				await client.query('COMMIT');
			} catch (err) {
				await client.query('ROLLBACK');
				throw new Error(`Migration ${m.file} failed: ${(err as Error).message}`, { cause: err });
			}
			done.push(m.file);
		}

		await syncPermissions(client);
		return done;
	} finally {
		await client.query(`SELECT pg_advisory_unlock(hashtextextended('restassured:migrate', 0))`);
		await client.end();
	}
}

/** ADR-0003: the catalogue in code is the source of truth; the table mirrors it. */
async function syncPermissions(client: pg.Client): Promise<void> {
	const codes = PERMISSIONS.map((p) => p.code);
	await client.query('BEGIN');
	try {
		await client.query(
			`INSERT INTO permissions (code, group_key, is_dangerous)
			 SELECT * FROM unnest($1::text[], $2::text[], $3::boolean[])
			 ON CONFLICT (code) DO UPDATE
			 SET group_key = excluded.group_key, is_dangerous = excluded.is_dangerous`,
			[codes, PERMISSIONS.map((p) => p.group), PERMISSIONS.map((p) => p.dangerous)]
		);
		// Grants of removed permissions go with them (ON DELETE CASCADE).
		await client.query('DELETE FROM permissions WHERE code <> ALL($1::text[])', [codes]);
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	}
}

function sha256(s: string): string {
	return createHash('sha256').update(s).digest('hex');
}
