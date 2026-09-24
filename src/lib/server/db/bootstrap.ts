// SPDX-License-Identifier: AGPL-3.0-or-later
import pg from 'pg';

export type BootstrapOptions = {
	/** Superuser connection; needed once, to create roles and the database. */
	adminUrl: string;
	database: string;
	ownerPassword: string;
	appPassword: string;
};

/**
 * Creates (or updates) the two database roles and the database. Idempotent.
 *
 * ADR-0001: `ra_owner` owns the schema and runs migrations. It has BYPASSRLS so the few
 * SECURITY DEFINER functions it owns (cross-tenant membership lookup, retention jobs) work
 * with FORCE ROW LEVEL SECURITY. `ra_app` is what the application connects as: no BYPASSRLS,
 * owns nothing, so row-level security always applies.
 */
export async function bootstrapDatabase(o: BootstrapOptions): Promise<void> {
	const admin = new pg.Client({ connectionString: o.adminUrl });
	await admin.connect();
	try {
		const common = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION';
		await ensureRole(admin, 'ra_owner', o.ownerPassword, `${common} BYPASSRLS`);
		await ensureRole(admin, 'ra_app', o.appPassword, `${common} NOBYPASSRLS`);

		const db = admin.escapeIdentifier(o.database);
		const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [o.database]);
		if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${db} OWNER ra_owner`);
		await admin.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
		await admin.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO ra_app`);
	} finally {
		await admin.end();
	}
}

/** Drops a database, disconnecting any sessions. Used by tests. */
export async function dropDatabase(adminUrl: string, database: string): Promise<void> {
	const admin = new pg.Client({ connectionString: adminUrl });
	await admin.connect();
	try {
		await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(database)} WITH (FORCE)`);
	} finally {
		await admin.end();
	}
}

async function ensureRole(admin: pg.Client, name: string, password: string, attributes: string) {
	const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]);
	const verb = exists.rowCount === 0 ? 'CREATE' : 'ALTER';
	await admin.query(
		`${verb} ROLE ${admin.escapeIdentifier(name)} WITH ${attributes} PASSWORD ${admin.escapeLiteral(password)}`
	);
}
