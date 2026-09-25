// SPDX-License-Identifier: AGPL-3.0-or-later
// Club member management: permissions, ADR-0003 guards, invites and admin-issued links.
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSecret } from '../../src/lib/server/auth/secrets';
import type { DB } from '../../src/lib/server/db/schema';
import { withTenant } from '../../src/lib/server/db/tenant';
import {
	createMember,
	getMember,
	inviteMember,
	issueAccountLink,
	listMembers,
	listRoles,
	setMemberRoles,
	setMemberStatus,
	updateMember
} from '../../src/lib/server/members';
import { createSuperAdmin } from '../../src/lib/server/platform';
import { resolveTenantContext } from '../../src/lib/server/tenancy';
import { appUrl, connect, ownerUrl } from './db';
import { helpers } from './helpers';

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

const { unique, member, actorFor, club, manager, customRole, roleByKey } = helpers(() => app);

describe('members', () => {
	it('creates reference members with only a name, and audits field names but no values', async () => {
		const { admin, tenantId } = await club();
		const id = await createMember(app, admin, { ...member('Piet Jansen'), phone: '0612345678' });
		expect(await getMember(app, admin, id)).toMatchObject({
			displayName: 'Piet Jansen',
			hasAccount: false
		});

		const audit = await withTenant(app, tenantId, (trx) =>
			trx
				.selectFrom('audit_log')
				.select('changed_fields')
				.where('subject_id', '=', id)
				.executeTakeFirstOrThrow()
		);
		expect(JSON.stringify(audit.changed_fields)).not.toContain('Piet');
		expect(JSON.stringify(audit.changed_fields)).not.toContain('0612345678');
		expect(audit.changed_fields).toMatchObject({ displayName: true, phone: true, email: false });
	});

	it('enforces permissions in the service layer', async () => {
		const { admin } = await club();
		const viewer = await manager(admin, [await roleByKey(admin, 'roles.viewer')]);
		const target = await createMember(app, admin, member('Target', `t-${unique()}@example.org`));
		await expect(createMember(app, viewer.actor, member('X'))).rejects.toThrow('errors.forbidden');
		await expect(updateMember(app, viewer.actor, target, member('Y'))).rejects.toThrow(
			'errors.forbidden'
		);
		await expect(inviteMember(app, viewer.actor, target)).rejects.toThrow('errors.forbidden');
		await expect(
			issueAccountLink(app, viewer.actor, admin.tenant.membershipId, 'magic_login')
		).rejects.toThrow('errors.forbidden');
		await expect(setMemberRoles(app, viewer.actor, target, [])).rejects.toThrow('errors.forbidden');
		expect((await getMember(app, viewer.actor, target)).displayName).toBe('Target');
	});

	it("can't see or change another club's members", async () => {
		const a = await club();
		const b = await club();
		const inB = await createMember(app, b.admin, member('Elsewhere'));
		await expect(getMember(app, a.admin, inB)).rejects.toThrow('errors.not_found');
		await expect(updateMember(app, a.admin, inB, member('Hijacked'))).rejects.toThrow(
			'errors.not_found'
		);
		await expect(getMember(app, a.admin, 'not-a-uuid')).rejects.toThrow('errors.not_found');
	});

	it('refuses changes while the club is suspended', async () => {
		const { admin, slug, tenantId } = await club();
		await owner
			.updateTable('tenants')
			.set({ status: 'suspended' })
			.where('id', '=', tenantId)
			.execute();
		const suspended = await actorFor(admin.userId, slug);
		await expect(createMember(app, suspended, member('X'))).rejects.toThrow(
			'club.errors.not_writable'
		);
	});
});

describe('invites and admin-issued links', () => {
	it('invites need an email address and a member without an account', async () => {
		const { admin } = await club();
		const noEmail = await createMember(app, admin, member('No email'));
		await expect(inviteMember(app, admin, noEmail)).rejects.toThrow(
			'members.errors.email_required'
		);
		const m = await manager(admin, []);
		await expect(inviteMember(app, admin, m.membershipId)).rejects.toThrow(
			'members.errors.has_account'
		);
	});

	it('issues login and reset links bound to the club, never for members without an account', async () => {
		const { admin, tenantId } = await club();
		const reference = await createMember(app, admin, member('Reference'));
		await expect(issueAccountLink(app, admin, reference, 'magic_login')).rejects.toThrow(
			'members.errors.no_account'
		);

		const m = await manager(admin, []);
		const link = await issueAccountLink(app, admin, m.membershipId, 'password_reset');
		const row = await owner
			.selectFrom('auth_tokens')
			.selectAll()
			.where('token_hash', '=', hashSecret(link.secret)!)
			.executeTakeFirstOrThrow();
		expect(row).toMatchObject({
			purpose: 'password_reset',
			user_id: m.userId,
			issued_by: admin.userId,
			issued_in_tenant_id: tenantId
		});
	});

	it('never issues links for platform accounts', async () => {
		const { admin } = await club();
		const m = await manager(admin, []);
		const email = (
			await app
				.selectFrom('users')
				.select('email')
				.where('id', '=', m.userId)
				.executeTakeFirstOrThrow()
		).email;
		await createSuperAdmin(app, email);
		await expect(issueAccountLink(app, admin, m.membershipId, 'magic_login')).rejects.toThrow(
			'members.errors.platform_account'
		);
	});
});

describe('role assignment guards (ADR-0003)', () => {
	it("prevents granting roles with permissions the actor doesn't hold", async () => {
		const { admin, tenantId } = await club();
		const limited = await manager(admin, [
			await customRole(tenantId, ['roles:manage', 'members:view', 'assets:view'])
		]);
		const target = await createMember(app, admin, member('Target'));

		await expect(
			setMemberRoles(app, limited.actor, target, [await roleByKey(admin, 'roles.quartermaster')])
		).rejects.toThrow('members.errors.escalation');
		const within = await customRole(tenantId, ['assets:view']);
		await setMemberRoles(app, limited.actor, target, [within]);
		expect((await getMember(app, admin, target)).roleIds).toEqual([within]);
	});

	it('reserves the admin role for admins', async () => {
		const { admin, tenantId } = await club();
		const everything = await customRole(tenantId, ['roles:manage', 'members:view']);
		const limited = await manager(admin, [everything]);
		const target = await createMember(app, admin, member('Target'));
		const adminRole = (await listRoles(app, admin)).find((r) => r.isSystem)!.id;
		await expect(setMemberRoles(app, limited.actor, target, [adminRole])).rejects.toThrow(
			'members.errors.admin_role_only'
		);
		await expect(setMemberRoles(app, limited.actor, admin.tenant.membershipId, [])).rejects.toThrow(
			'members.errors.admin_role_only'
		);
	});

	it('keeps at least one active admin', async () => {
		const { admin } = await club();
		const adminRole = (await listRoles(app, admin)).find((r) => r.isSystem)!.id;
		await expect(setMemberRoles(app, admin, admin.tenant.membershipId, [])).rejects.toThrow(
			'members.errors.last_admin'
		);
		await expect(
			setMemberStatus(app, admin, admin.tenant.membershipId, 'inactive')
		).rejects.toThrow('members.errors.last_admin');

		// An admin role on a member without an account doesn't count as a usable admin.
		const reference = await createMember(app, admin, member('No account'));
		await setMemberRoles(app, admin, reference, [adminRole]);
		await expect(setMemberRoles(app, admin, admin.tenant.membershipId, [])).rejects.toThrow(
			'members.errors.last_admin'
		);

		const second = await manager(admin, [adminRole]);
		await setMemberRoles(app, admin, admin.tenant.membershipId, []);
		const after = await actorFor(second.userId, admin.tenant.slug);
		expect(after.tenant.isTenantAdmin).toBe(true);
	});

	it('removes access when a member is set to inactive', async () => {
		const { admin } = await club();
		const m = await manager(admin, [await roleByKey(admin, 'roles.viewer')]);
		await setMemberStatus(app, admin, m.membershipId, 'inactive');
		expect(await resolveTenantContext(app, m.userId, admin.tenant.slug, null)).toBeNull();
	});
});

describe('listing', () => {
	it('lists members with account flags and role ids', async () => {
		const { admin } = await club();
		await createMember(app, admin, member('Zoë'));
		const list = await listMembers(app, admin);
		expect(list.map((m) => m.displayName)).toEqual(['Admin', 'Zoë']);
		expect(list[0]).toMatchObject({ hasAccount: true, roleIds: [expect.any(String)] });
		expect(list[1]).toMatchObject({ hasAccount: false, roleIds: [] });
	});
});
