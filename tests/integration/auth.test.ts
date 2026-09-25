// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0004: sessions, one-time links, invites, and the cross-tenant guard.
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	acceptInvite,
	consumeMagicLogin,
	consumePasswordReset,
	describeInvite
} from '$lib/server/auth/links';
import { changePassword, loginWithPassword } from '$lib/server/auth/login';
import { withinRateLimit } from '$lib/server/auth/rate-limit';
import { hashSecret } from '$lib/server/auth/secrets';
import { createSession, revokeUserSessions, validateSession } from '$lib/server/auth/sessions';
import { issueToken } from '$lib/server/auth/tokens';
import type { DB } from '$lib/server/db/schema';
import { withTenant } from '$lib/server/db/tenant';
import { createSuperAdmin, provisionTenant, ROLE_TEMPLATES } from '$lib/server/platform';
import { resolveTenantContext } from '$lib/server/tenancy';
import { appUrl, connect, ownerUrl } from './db';

let app: Kysely<DB>;
let owner: Kysely<DB>;

beforeAll(() => {
	app = connect(appUrl);
	owner = connect(ownerUrl);
});

afterAll(async () => {
	await app.destroy();
	await owner.destroy();
});

const unique = () => randomUUID().slice(0, 8);
const PASSWORD = 'correct horse battery staple';

/** A club whose first admin has accepted the invite. */
async function clubWithAdmin(adminEmail = `admin-${unique()}@example.org`) {
	const slug = `club-${unique()}`;
	const { tenantId, invite } = await provisionTenant(
		app,
		{ slug, name: `Club ${slug}`, defaultLocale: 'nl', adminName: 'Admin', adminEmail },
		null
	);
	const existing = await app
		.selectFrom('users')
		.select('id')
		.where('email', '=', adminEmail)
		.executeTakeFirst();
	const { userId } = await acceptInvite(app, invite.secret, existing?.id ?? null);
	return { tenantId, slug, adminUserId: userId };
}

/** Adds a reference member to a club and links it to a (new or given) account via an invite. */
async function addMemberWithAccount(tenantId: string, email: string, currentUserId: string | null) {
	const { id: membershipId } = await withTenant(app, tenantId, (trx) =>
		trx
			.insertInto('tenant_memberships')
			.values({ tenant_id: tenantId, display_name: 'Member', email })
			.returning('id')
			.executeTakeFirstOrThrow()
	);
	const invite = await issueToken(app, {
		purpose: 'invite',
		membership: { tenantId, membershipId }
	});
	return acceptInvite(app, invite.secret, currentUserId);
}

describe('sessions', () => {
	it('validates, expires when idle or past the absolute lifetime, and revokes', async () => {
		const { adminUserId } = await clubWithAdmin();
		const s = await createSession(app, adminUserId, null);
		expect((await validateSession(app, s.secret))?.user.id).toBe(adminUserId);
		expect(await validateSession(app, 'not-a-session')).toBeNull();

		const hash = hashSecret(s.secret)!;
		await owner
			.updateTable('sessions')
			.set({ last_seen_at: sql`now() - interval '15 days'` })
			.where('token_hash', '=', hash)
			.execute();
		expect(await validateSession(app, s.secret)).toBeNull();

		const s2 = await createSession(app, adminUserId, null);
		await owner
			.updateTable('sessions')
			.set({ expires_at: sql`now() - interval '1 second'` })
			.where('token_hash', '=', hashSecret(s2.secret)!)
			.execute();
		expect(await validateSession(app, s2.secret)).toBeNull();

		const s3 = await createSession(app, adminUserId, null);
		await revokeUserSessions(app, adminUserId);
		expect(await validateSession(app, s3.secret)).toBeNull();
	});
});

describe('one-time links', () => {
	it('work once, and never after expiry or for another purpose', async () => {
		const { adminUserId } = await clubWithAdmin();
		const link = await issueToken(app, { purpose: 'magic_login', userId: adminUserId });
		await expect(consumePasswordReset(app, link.secret, PASSWORD)).rejects.toThrow(
			'links.errors.invalid'
		);
		expect((await consumeMagicLogin(app, link.secret)).userId).toBe(adminUserId);
		await expect(consumeMagicLogin(app, link.secret)).rejects.toThrow('links.errors.invalid');

		const expired = await issueToken(app, { purpose: 'magic_login', userId: adminUserId });
		await owner
			.updateTable('auth_tokens')
			.set({ expires_at: sql`now() - interval '1 second'` })
			.where('token_hash', '=', hashSecret(expired.secret)!)
			.execute();
		await expect(consumeMagicLogin(app, expired.secret)).rejects.toThrow('links.errors.invalid');
	});

	it('can be consumed only once even when used concurrently', async () => {
		const { adminUserId } = await clubWithAdmin();
		const link = await issueToken(app, { purpose: 'magic_login', userId: adminUserId });
		const results = await Promise.allSettled(
			[1, 2, 3].map(() => consumeMagicLogin(app, link.secret))
		);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
	});

	it('reset sets the password, signs out everywhere, and rejects weak passwords', async () => {
		const { adminUserId } = await clubWithAdmin();
		const old = await createSession(app, adminUserId, null);
		const link = await issueToken(app, { purpose: 'password_reset', userId: adminUserId });
		await expect(consumePasswordReset(app, link.secret, 'short')).rejects.toThrow(
			'errors.password.too_short'
		);
		const signedIn = await consumePasswordReset(app, link.secret, PASSWORD);
		expect(await validateSession(app, old.secret)).toBeNull();
		expect((await validateSession(app, signedIn.session.secret))?.user.hasPassword).toBe(true);
	});
});

describe('provisioning and invites', () => {
	it('creates the club with an admin role, role templates, theme, and an admin invite', async () => {
		const email = `first-${unique()}@example.org`;
		const { tenantId, slug, adminUserId } = await clubWithAdmin(email);
		const ctx = await resolveTenantContext(app, adminUserId, slug, null);
		expect(ctx?.isTenantAdmin).toBe(true);
		const roles = await withTenant(app, tenantId, (trx) =>
			trx
				.selectFrom('roles')
				.select(['label_key', 'is_system'])
				.where('tenant_id', '=', tenantId)
				.execute()
		);
		expect(roles.map((r) => r.label_key).sort()).toEqual(
			['roles.tenant_admin', ...ROLE_TEMPLATES.map((r) => r.labelKey)].sort()
		);
		await expect(
			provisionTenant(
				app,
				{ slug, name: 'Dup', defaultLocale: 'en', adminName: 'X', adminEmail: email },
				null
			)
		).rejects.toThrow('platform.errors.slug_taken');
	});

	it('describes an invite without consuming it', async () => {
		const slug = `club-${unique()}`;
		const { invite } = await provisionTenant(
			app,
			{
				slug,
				name: 'Harmonie',
				defaultLocale: 'nl',
				adminName: 'Anna',
				adminEmail: `anna-${unique()}@example.org`
			},
			null
		);
		expect(await describeInvite(app, invite.secret)).toMatchObject({
			tenantName: 'Harmonie',
			displayName: 'Anna'
		});
		expect(await describeInvite(app, invite.secret)).not.toBeNull();
	});

	it('requires signing in to an existing account first, and never merges silently', async () => {
		const email = `existing-${unique()}@example.org`;
		const first = await clubWithAdmin(email);
		const second = await clubWithAdmin();
		const { id: membershipId } = await withTenant(app, second.tenantId, (trx) =>
			trx
				.insertInto('tenant_memberships')
				.values({ tenant_id: second.tenantId, display_name: 'Same person', email })
				.returning('id')
				.executeTakeFirstOrThrow()
		);
		const invite = await issueToken(app, {
			purpose: 'invite',
			membership: { tenantId: second.tenantId, membershipId }
		});

		await expect(acceptInvite(app, invite.secret, null)).rejects.toThrow(
			'links.errors.invite_sign_in_first'
		);
		await expect(acceptInvite(app, invite.secret, second.adminUserId)).rejects.toThrow(
			'links.errors.invite_sign_in_first'
		);
		const accepted = await acceptInvite(app, invite.secret, first.adminUserId);
		expect(accepted.userId).toBe(first.adminUserId);
		expect(accepted.newAccount).toBe(false);
		await expect(acceptInvite(app, invite.secret, first.adminUserId)).rejects.toThrow(
			'links.errors.invalid'
		);
	});

	it('asks a signed-in user to sign out before creating a different account', async () => {
		const club = await clubWithAdmin();
		await expect(
			addMemberWithAccount(club.tenantId, `new-${unique()}@example.org`, club.adminUserId)
		).rejects.toThrow('links.errors.invite_sign_out_first');
	});
});

describe('cross-tenant guard (ADR-0004 §4)', () => {
	async function personInTwoClubs() {
		const a = await clubWithAdmin();
		const b = await clubWithAdmin();
		const email = `person-${unique()}@example.org`;
		const { userId } = await addMemberWithAccount(a.tenantId, email, null);
		await addMemberWithAccount(b.tenantId, email, userId);
		return { a, b, userId, email };
	}

	it('scopes a session from a club admin link to that club', async () => {
		const { a, b, userId } = await personInTwoClubs();
		const link = await issueToken(app, {
			purpose: 'magic_login',
			userId,
			issuedBy: a.adminUserId,
			issuedInTenantId: a.tenantId
		});
		const signedIn = await consumeMagicLogin(app, link.secret);
		expect(signedIn.scopedTenantId).toBe(a.tenantId);
		expect(await resolveTenantContext(app, userId, a.slug, signedIn.scopedTenantId)).not.toBeNull();
		expect(await resolveTenantContext(app, userId, b.slug, signedIn.scopedTenantId)).toBeNull();
	});

	it('keeps the scope on a password set through such a link, so password login cannot bypass it', async () => {
		const { a, b, userId, email } = await personInTwoClubs();
		const link = await issueToken(app, {
			purpose: 'password_reset',
			userId,
			issuedBy: a.adminUserId,
			issuedInTenantId: a.tenantId
		});
		await consumePasswordReset(app, link.secret, PASSWORD);

		const login = await loginWithPassword(app, {
			email,
			password: PASSWORD,
			clientAddress: `10.0.0.${unique()}`
		});
		expect(login.scopedTenantId).toBe(a.tenantId);
		expect(await resolveTenantContext(app, userId, b.slug, login.scopedTenantId)).toBeNull();

		// Changing the password from the scoped session keeps the scope…
		await changePassword(app, {
			userId,
			scopedTenantId: a.tenantId,
			currentPassword: PASSWORD,
			newPassword: `${PASSWORD}!`
		});
		const again = await loginWithPassword(app, {
			email,
			password: `${PASSWORD}!`,
			clientAddress: `10.0.1.${unique()}`
		});
		expect(again.scopedTenantId).toBe(a.tenantId);

		// …and only a change from an unscoped session (e.g. after a platform-issued link) clears it.
		await changePassword(app, {
			userId,
			scopedTenantId: null,
			currentPassword: `${PASSWORD}!`,
			newPassword: PASSWORD
		});
		const cleared = await loginWithPassword(app, {
			email,
			password: PASSWORD,
			clientAddress: `10.0.2.${unique()}`
		});
		expect(cleared.scopedTenantId).toBeNull();
	});

	it('does not scope links from an admin of all the person’s clubs, or for single-club members', async () => {
		const { a, b, userId } = await personInTwoClubs();
		// Make A's admin also admin of B.
		await addMemberWithAccount(
			b.tenantId,
			(
				await app
					.selectFrom('users')
					.select('email')
					.where('id', '=', a.adminUserId)
					.executeTakeFirstOrThrow()
			).email,
			a.adminUserId
		);
		await withTenant(app, b.tenantId, async (trx) => {
			const adminRole = await trx
				.selectFrom('roles')
				.select('id')
				.where('tenant_id', '=', b.tenantId)
				.where('is_system', '=', true)
				.executeTakeFirstOrThrow();
			const m = await trx
				.selectFrom('tenant_memberships')
				.select('id')
				.where('tenant_id', '=', b.tenantId)
				.where('user_id', '=', a.adminUserId)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('membership_roles')
				.values({ tenant_id: b.tenantId, membership_id: m.id, role_id: adminRole.id })
				.execute();
		});
		const link = await issueToken(app, {
			purpose: 'magic_login',
			userId,
			issuedBy: a.adminUserId,
			issuedInTenantId: a.tenantId
		});
		expect((await consumeMagicLogin(app, link.secret)).scopedTenantId).toBeNull();

		const solo = await clubWithAdmin();
		const { userId: soloUser } = await addMemberWithAccount(
			solo.tenantId,
			`solo-${unique()}@example.org`,
			null
		);
		const soloLink = await issueToken(app, {
			purpose: 'magic_login',
			userId: soloUser,
			issuedBy: solo.adminUserId,
			issuedInTenantId: solo.tenantId
		});
		expect((await consumeMagicLogin(app, soloLink.secret)).scopedTenantId).toBeNull();
	});
});

describe('password login', () => {
	it('gives the same error for unknown accounts and wrong passwords', async () => {
		const { adminUserId } = await clubWithAdmin();
		const email = (
			await app
				.selectFrom('users')
				.select('email')
				.where('id', '=', adminUserId)
				.executeTakeFirstOrThrow()
		).email;
		const reset = await issueToken(app, { purpose: 'password_reset', userId: adminUserId });
		await consumePasswordReset(app, reset.secret, PASSWORD);
		const ip = `10.1.0.${unique()}`;
		await expect(
			loginWithPassword(app, { email, password: 'wrong password!!', clientAddress: ip })
		).rejects.toThrow('auth.errors.invalid_credentials');
		await expect(
			loginWithPassword(app, {
				email: `nobody-${unique()}@example.org`,
				password: PASSWORD,
				clientAddress: ip
			})
		).rejects.toThrow('auth.errors.invalid_credentials');
		expect(
			(
				await loginWithPassword(app, {
					email: email.toUpperCase(),
					password: PASSWORD,
					clientAddress: ip
				})
			).userId
		).toBe(adminUserId);
	});

	it('is rate limited per account', async () => {
		const email = `limited-${unique()}@example.org`;
		for (let i = 0; i < 10; i++) {
			await expect(
				loginWithPassword(app, { email, password: 'x', clientAddress: `10.2.${i}.1` })
			).rejects.toThrow('auth.errors.invalid_credentials');
		}
		await expect(
			loginWithPassword(app, { email, password: 'x', clientAddress: '10.2.99.1' })
		).rejects.toThrow('errors.rate_limited');
	});
});

describe('rate limiting', () => {
	it('allows up to the limit within the window, then refuses; keys are hashed', async () => {
		const id = `ip-${unique()}`;
		const results = [];
		for (let i = 0; i < 4; i++)
			results.push(await withinRateLimit(app, 'test', id, { limit: 3, windowSeconds: 60 }));
		expect(results).toEqual([true, true, true, false]);
		const keys = await app.selectFrom('rate_limits').select('key').execute();
		expect(keys.some((k) => k.key.includes(id))).toBe(false);
	});
});

describe('super admin bootstrap', () => {
	it('grants the platform role and returns a working login link', async () => {
		const email = `root-${unique()}@example.org`;
		const { userId, login } = await createSuperAdmin(app, email);
		const signedIn = await consumeMagicLogin(app, login.secret);
		const session = await validateSession(app, signedIn.session.secret);
		expect(session?.user).toMatchObject({ id: userId, platformRole: 'super_admin' });
		expect((await createSuperAdmin(app, email.toUpperCase())).userId).toBe(userId);
	});
});
