// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql, type Kysely, type Selectable } from 'kysely';
import type { AuthTokens, DB } from '$lib/server/db/schema';
import { hashSecret, newSecret } from '$lib/server/auth/secrets';

export type TokenPurpose = 'magic_login' | 'invite' | 'password_reset';
export type TokenRow = Selectable<AuthTokens>;

// ADR-0004 lifetimes.
export const TOKEN_TTL_SECONDS: Record<TokenPurpose, number> = {
	magic_login: 15 * 60,
	invite: 7 * 24 * 60 * 60,
	password_reset: 24 * 60 * 60
};

export type IssueTokenInput = {
	purpose: TokenPurpose;
	userId?: string | null;
	membership?: { tenantId: string; membershipId: string } | null;
	issuedBy?: string | null;
	issuedInTenantId?: string | null;
};

/** Creates a single-use link token. The plaintext is returned once and never stored. */
export async function issueToken(
	db: Kysely<DB>,
	input: IssueTokenInput
): Promise<{ secret: string; expiresAt: Date }> {
	const { secret, hash } = newSecret();
	const { expires_at } = await db
		.insertInto('auth_tokens')
		.values({
			token_hash: hash,
			purpose: input.purpose,
			user_id: input.userId ?? null,
			target_tenant_id: input.membership?.tenantId ?? null,
			membership_id: input.membership?.membershipId ?? null,
			issued_by: input.issuedBy ?? null,
			issued_in_tenant_id: input.issuedInTenantId ?? null,
			expires_at: sql<Date>`now() + make_interval(secs => ${TOKEN_TTL_SECONDS[input.purpose]})`
		})
		.returning('expires_at')
		.executeTakeFirstOrThrow();
	return { secret, expiresAt: expires_at };
}

/**
 * An unexpired, unconsumed token. With `lock`, the row is locked FOR UPDATE, so two concurrent
 * consumptions of the same link serialise and only one succeeds.
 */
export async function findUsableToken(
	db: Kysely<DB>,
	secret: string,
	opts: { lock: boolean }
): Promise<TokenRow | null> {
	const hash = hashSecret(secret);
	if (!hash) return null;
	let query = db
		.selectFrom('auth_tokens')
		.selectAll()
		.where('token_hash', '=', hash)
		.where('consumed_at', 'is', null)
		.where('expires_at', '>', sql<Date>`now()`);
	if (opts.lock) query = query.forUpdate();
	return (await query.executeTakeFirst()) ?? null;
}

export async function markConsumed(db: Kysely<DB>, token: TokenRow): Promise<void> {
	await db
		.updateTable('auth_tokens')
		.set({ consumed_at: sql<Date>`now()` })
		.where('token_hash', '=', token.token_hash)
		.execute();
}

/** Invalidates a user's outstanding login/reset links, e.g. after a password change. */
export async function revokeUserTokens(db: Kysely<DB>, userId: string): Promise<void> {
	await db
		.updateTable('auth_tokens')
		.set({ consumed_at: sql<Date>`now()` })
		.where('user_id', '=', userId)
		.where('consumed_at', 'is', null)
		.where('purpose', 'in', ['magic_login', 'password_reset'])
		.execute();
}
