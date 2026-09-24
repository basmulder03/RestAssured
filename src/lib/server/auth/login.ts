// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql, type Kysely } from 'kysely';
import { auditPlatform } from '../audit';
import type { DB } from '../db/schema';
import { DomainError } from '../errors';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { LIMITS, withinRateLimit } from './rate-limit';
import { createSession, revokeUserSessions } from './sessions';
import { revokeUserTokens } from './tokens';

/**
 * Password login. Every failure is the same error, so responses don't reveal whether an
 * account exists (ADR-0004). Rate-limited per account and per client address.
 */
export async function loginWithPassword(
	db: Kysely<DB>,
	input: { email: string; password: string; clientAddress: string }
) {
	const email = input.email.trim().toLowerCase();
	const [perAccount, perIp] = await Promise.all([
		withinRateLimit(db, 'login:account', email, LIMITS.loginPerAccount),
		withinRateLimit(db, 'login:ip', input.clientAddress, LIMITS.loginPerIp)
	]);
	if (!perAccount || !perIp) throw new DomainError('errors.rate_limited');

	const user = await db
		.selectFrom('users')
		.select(['id', 'password_hash', 'credential_scope_tenant_id'])
		.where(sql<string>`lower(email)`, '=', email)
		.where('erased_at', 'is', null)
		.executeTakeFirst();
	const ok = await verifyPassword(user?.password_hash ?? null, input.password);
	if (!user || !ok) throw new DomainError('auth.errors.invalid_credentials');

	// ADR-0004 §4: a password set through a club-scoped link only opens that club.
	const scopedTenantId = user.credential_scope_tenant_id;
	const session = await createSession(db, user.id, scopedTenantId);
	await auditPlatform(db, user.id, {
		action: 'auth.password_login',
		subjectType: 'user',
		subjectId: user.id,
		changedFields: { scoped: scopedTenantId !== null }
	});
	return { userId: user.id, session, scopedTenantId };
}

/**
 * Sets or changes a signed-in user's password. Changing an existing password requires the
 * current one. All other sessions and outstanding login links are revoked. The password takes
 * the scope of the session that set it (ADR-0004 §4).
 */
export async function changePassword(
	db: Kysely<DB>,
	input: {
		userId: string;
		scopedTenantId: string | null;
		currentPassword: string | null;
		newPassword: string;
	}
) {
	return db.transaction().execute(async (trx) => {
		const user = await trx
			.selectFrom('users')
			.select(['id', 'email', 'password_hash'])
			.where('id', '=', input.userId)
			.executeTakeFirstOrThrow();
		if (
			user.password_hash &&
			!(await verifyPassword(user.password_hash, input.currentPassword ?? ''))
		) {
			throw new DomainError('auth.errors.current_password_wrong');
		}
		const problem = passwordProblem(input.newPassword, user.email);
		if (problem) throw new DomainError(problem);

		await trx
			.updateTable('users')
			.set({
				password_hash: await hashPassword(input.newPassword),
				credential_scope_tenant_id: input.scopedTenantId,
				updated_at: sql<Date>`now()`
			})
			.where('id', '=', user.id)
			.execute();
		await revokeUserSessions(trx, user.id);
		await revokeUserTokens(trx, user.id);
		const session = await createSession(trx, user.id, input.scopedTenantId);
		await auditPlatform(trx, user.id, {
			action: 'auth.password_changed',
			subjectType: 'user',
			subjectId: user.id,
			changedFields: { password_hash: true }
		});
		return session;
	});
}
