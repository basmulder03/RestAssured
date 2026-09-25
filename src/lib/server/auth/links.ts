// SPDX-License-Identifier: AGPL-3.0-or-later
// Consuming one-time links (ADR-0004). Each flow runs in one transaction: lock the token, check,
// apply, mark consumed, create the session. A failed check leaves the link usable.
import { sql, type Kysely, type Transaction } from 'kysely';
import { auditPlatform, auditTenant } from '$lib/server/audit';
import type { DB } from '$lib/server/db/schema';
import { setTenant, userAdminTenants, userMemberships } from '$lib/server/db/tenant';
import { DomainError } from '$lib/server/errors';
import { hashPassword, passwordProblem } from '$lib/server/auth/password';
import { createSession, revokeUserSessions } from '$lib/server/auth/sessions';
import {
	findUsableToken,
	markConsumed,
	revokeUserTokens,
	type TokenRow
} from '$lib/server/auth/tokens';

export type SignedIn = {
	userId: string;
	session: { secret: string; expiresAt: Date };
	scopedTenantId: string | null;
	redirectTo: string;
};

/**
 * ADR-0004 §4: a link issued by an admin of club A for someone who is also a member of club B
 * (where the issuer isn't admin) must not open club B, or any club admin could take over a
 * person's account elsewhere. Such sessions are scoped to the issuing club.
 */
export async function scopeForToken(db: Kysely<DB>, token: TokenRow): Promise<string | null> {
	if (!token.issued_by || !token.issued_in_tenant_id || !token.user_id) return null;
	const [targetMemberships, issuerAdminOf] = await Promise.all([
		userMemberships(db, token.user_id),
		userAdminTenants(db, token.issued_by)
	]);
	const exposesOtherClub = targetMemberships.some(
		(m) => m.tenantId !== token.issued_in_tenant_id && !issuerAdminOf.includes(m.tenantId)
	);
	return exposesOtherClub ? token.issued_in_tenant_id : null;
}

async function usableToken(trx: Transaction<DB>, secret: string, purpose: string) {
	const token = await findUsableToken(trx, secret, { lock: true });
	if (!token || token.purpose !== purpose) throw new DomainError('links.errors.invalid');
	return token;
}

async function activeUser(trx: Kysely<DB>, userId: string) {
	const user = await trx
		.selectFrom('users')
		.select(['id', 'email'])
		.where('id', '=', userId)
		.where('erased_at', 'is', null)
		.executeTakeFirst();
	if (!user) throw new DomainError('links.errors.invalid');
	return user;
}

export async function consumeMagicLogin(db: Kysely<DB>, secret: string): Promise<SignedIn> {
	return db.transaction().execute(async (trx) => {
		const token = await usableToken(trx, secret, 'magic_login');
		const user = await activeUser(trx, token.user_id!);
		await markConsumed(trx, token);
		const scopedTenantId = await scopeForToken(trx, token);
		const session = await createSession(trx, user.id, scopedTenantId);
		await auditPlatform(trx, user.id, {
			action: 'auth.link_login',
			subjectType: 'user',
			subjectId: user.id,
			changedFields: { issued_by: token.issued_by, scoped: scopedTenantId !== null }
		});
		return { userId: user.id, session, scopedTenantId, redirectTo: '/' };
	});
}

export async function consumePasswordReset(
	db: Kysely<DB>,
	secret: string,
	newPassword: string
): Promise<SignedIn> {
	return db.transaction().execute(async (trx) => {
		const token = await usableToken(trx, secret, 'password_reset');
		const user = await activeUser(trx, token.user_id!);
		const problem = passwordProblem(newPassword, user.email);
		if (problem) throw new DomainError(problem);

		const scopedTenantId = await scopeForToken(trx, token);
		await trx
			.updateTable('users')
			.set({
				password_hash: await hashPassword(newPassword),
				credential_scope_tenant_id: scopedTenantId,
				updated_at: sql<Date>`now()`
			})
			.where('id', '=', user.id)
			.execute();
		await markConsumed(trx, token);
		await revokeUserSessions(trx, user.id);
		await revokeUserTokens(trx, user.id);
		const session = await createSession(trx, user.id, scopedTenantId);
		await auditPlatform(trx, user.id, {
			action: 'auth.password_reset',
			subjectType: 'user',
			subjectId: user.id,
			changedFields: { password_hash: true, issued_by: token.issued_by }
		});
		return { userId: user.id, session, scopedTenantId, redirectTo: '/' };
	});
}

export type InviteSummary = { tenantName: string; displayName: string; email: string };

/** What an invite link is for, shown before accepting. Doesn't lock or consume. */
export async function describeInvite(
	db: Kysely<DB>,
	secret: string
): Promise<InviteSummary | null> {
	return db.transaction().execute(async (trx) => {
		const token = await findUsableToken(trx, secret, { lock: false });
		if (!token || token.purpose !== 'invite') return null;
		const target = await inviteTarget(trx, token);
		return (
			target && {
				tenantName: target.tenantName,
				displayName: target.displayName,
				email: target.email
			}
		);
	});
}

async function inviteTarget(trx: Transaction<DB>, token: TokenRow) {
	await setTenant(trx, token.target_tenant_id!);
	const row = await trx
		.selectFrom('tenant_memberships as m')
		.innerJoin('tenants as t', 't.id', 'm.tenant_id')
		.select(['m.id', 'm.user_id', 'm.email', 'm.display_name', 'm.status', 't.slug', 't.name'])
		.where('m.tenant_id', '=', token.target_tenant_id!)
		.where('m.id', '=', token.membership_id!)
		.executeTakeFirst();
	if (!row || row.status !== 'active' || !row.email || !row.display_name) return null;
	return {
		membershipId: row.id,
		userId: row.user_id,
		email: row.email,
		displayName: row.display_name,
		tenantSlug: row.slug,
		tenantName: row.name
	};
}

/**
 * Accepting an invite links an account to the person's existing membership (ADR-0001, 0004 §5).
 * A new email creates an account. An email that already has an account must be signed in as
 * that account first: accounts are never merged or taken over silently.
 */
export async function acceptInvite(
	db: Kysely<DB>,
	secret: string,
	currentUserId: string | null
): Promise<SignedIn & { newAccount: boolean }> {
	return db.transaction().execute(async (trx) => {
		const token = await usableToken(trx, secret, 'invite');
		const target = await inviteTarget(trx, token);
		if (!target) throw new DomainError('links.errors.invalid');
		if (target.userId) throw new DomainError('links.errors.already_linked');

		const existing = await trx
			.selectFrom('users')
			.select(['id'])
			.where(sql<string>`lower(email)`, '=', target.email.toLowerCase())
			.where('erased_at', 'is', null)
			.executeTakeFirst();

		let userId: string;
		if (existing) {
			if (currentUserId !== existing.id) throw new DomainError('links.errors.invite_sign_in_first');
			const alreadyMember = await trx
				.selectFrom('tenant_memberships')
				.select('id')
				.where('tenant_id', '=', token.target_tenant_id!)
				.where('user_id', '=', existing.id)
				.executeTakeFirst();
			if (alreadyMember) throw new DomainError('links.errors.already_member');
			userId = existing.id;
		} else {
			if (currentUserId) throw new DomainError('links.errors.invite_sign_out_first');
			({ id: userId } = await trx
				.insertInto('users')
				.values({ email: target.email })
				.returning('id')
				.executeTakeFirstOrThrow());
		}

		await trx
			.updateTable('tenant_memberships')
			.set({ user_id: userId, updated_at: sql<Date>`now()` })
			.where('tenant_id', '=', token.target_tenant_id!)
			.where('id', '=', target.membershipId)
			.execute();
		await markConsumed(trx, token);
		await auditTenant(trx, token.target_tenant_id!, target.membershipId, {
			action: 'member.account_linked',
			subjectType: 'membership',
			subjectId: target.membershipId,
			changedFields: { user_id: true, new_account: !existing }
		});
		const session = await createSession(trx, userId, null);
		return {
			userId,
			session,
			scopedTenantId: null,
			redirectTo: `/t/${target.tenantSlug}`,
			newAccount: !existing
		};
	});
}
