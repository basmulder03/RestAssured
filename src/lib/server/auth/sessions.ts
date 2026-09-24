// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/schema';
import { hashSecret, newSecret } from './secrets';

// ADR-0004: idle timeout 14 days, absolute lifetime 60 days.
export const SESSION_IDLE_DAYS = 14;
export const SESSION_ABSOLUTE_DAYS = 60;
// Writing last_seen_at on every request is wasteful; an hour of precision is plenty.
const TOUCH_AFTER_MS = 60 * 60 * 1000;

/** `__Host-` pins the cookie to this origin over HTTPS; plain HTTP is only for local dev. */
export function sessionCookieName(secure: boolean): string {
	return secure ? '__Host-ra_session' : 'ra_session';
}

export type SessionUser = {
	id: string;
	email: string;
	platformRole: 'super_admin' | 'support' | null;
	preferredLocale: string | null;
	lastTenantId: string | null;
	hasPassword: boolean;
};

export type Session = { user: SessionUser; scopedTenantId: string | null; expiresAt: Date };

export async function createSession(
	db: Kysely<DB>,
	userId: string,
	scopedTenantId: string | null
): Promise<{ secret: string; expiresAt: Date }> {
	const { secret, hash } = newSecret();
	const { expires_at } = await db
		.insertInto('sessions')
		.values({
			token_hash: hash,
			user_id: userId,
			scoped_tenant_id: scopedTenantId,
			expires_at: sql<Date>`now() + make_interval(days => ${SESSION_ABSOLUTE_DAYS})`
		})
		.returning('expires_at')
		.executeTakeFirstOrThrow();
	return { secret, expiresAt: expires_at };
}

export async function validateSession(db: Kysely<DB>, secret: string): Promise<Session | null> {
	const hash = hashSecret(secret);
	if (!hash) return null;
	const row = await db
		.selectFrom('sessions as s')
		.innerJoin('users as u', 'u.id', 's.user_id')
		.select([
			's.scoped_tenant_id',
			's.expires_at',
			's.last_seen_at',
			'u.id',
			'u.email',
			'u.platform_role',
			'u.preferred_locale',
			'u.last_tenant_id',
			'u.password_hash'
		])
		.where('s.token_hash', '=', hash)
		.where('s.expires_at', '>', sql<Date>`now()`)
		.where('s.last_seen_at', '>', sql<Date>`now() - make_interval(days => ${SESSION_IDLE_DAYS})`)
		.where('u.erased_at', 'is', null)
		.executeTakeFirst();
	if (!row) return null;

	if (Date.now() - row.last_seen_at.getTime() > TOUCH_AFTER_MS) {
		await db
			.updateTable('sessions')
			.set({ last_seen_at: sql<Date>`now()` })
			.where('token_hash', '=', hash)
			.execute();
	}
	return {
		user: {
			id: row.id,
			email: row.email,
			platformRole: row.platform_role as SessionUser['platformRole'],
			preferredLocale: row.preferred_locale,
			lastTenantId: row.last_tenant_id,
			hasPassword: row.password_hash !== null
		},
		scopedTenantId: row.scoped_tenant_id,
		expiresAt: row.expires_at
	};
}

export async function revokeSession(db: Kysely<DB>, secret: string): Promise<void> {
	const hash = hashSecret(secret);
	if (hash) await db.deleteFrom('sessions').where('token_hash', '=', hash).execute();
}

/** Signs a user out everywhere (after a password change or reset). */
export async function revokeUserSessions(db: Kysely<DB>, userId: string): Promise<void> {
	await db.deleteFrom('sessions').where('user_id', '=', userId).execute();
}
