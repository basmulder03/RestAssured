// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/schema';
import { sha256Hex } from './secrets';

export type RateLimit = { limit: number; windowSeconds: number };

export const LIMITS = {
	loginPerAccount: { limit: 10, windowSeconds: 15 * 60 },
	loginPerIp: { limit: 50, windowSeconds: 15 * 60 },
	linkPerIp: { limit: 30, windowSeconds: 60 }
} as const satisfies Record<string, RateLimit>;

/**
 * Counts a hit and reports whether the caller is still within the limit. Identities (emails, IP
 * addresses) are hashed so the table holds no personal data.
 */
export async function withinRateLimit(
	db: Kysely<DB>,
	bucket: string,
	identity: string,
	{ limit, windowSeconds }: RateLimit
): Promise<boolean> {
	const key = `${bucket}:${sha256Hex(identity.toLowerCase())}`;
	const { rows } = await sql<{ ok: boolean }>`
		SELECT ra_rate_limit_hit(${key}, ${limit}, make_interval(secs => ${windowSeconds})) AS ok
	`.execute(db);
	return rows[0]?.ok ?? false;
}
