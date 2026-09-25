// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared setup for integration tests: clubs with a signed-up admin, managers with roles.
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Permission } from '../../src/lib/domain/permissions';
import { acceptInvite } from '../../src/lib/server/auth/links';
import type { DB } from '../../src/lib/server/db/schema';
import { withTenant } from '../../src/lib/server/db/tenant';
import {
	createMember,
	inviteMember,
	listRoles,
	setMemberRoles,
	type Actor,
	type MemberInput
} from '../../src/lib/server/members';
import { provisionTenant } from '../../src/lib/server/platform';
import { resolveTenantContext } from '../../src/lib/server/tenancy';

/** `db` is a getter because connections are opened in beforeAll. */
export function helpers(db: () => Kysely<DB>) {
	const unique = () => randomUUID().slice(0, 8);
	const member = (displayName: string, email: string | null = null): MemberInput => ({
		displayName,
		email,
		phone: null,
		memberNumber: null,
		notes: null
	});

	async function actorFor(userId: string, slug: string): Promise<Actor> {
		const tenant = await resolveTenantContext(db(), userId, slug, null);
		if (!tenant) throw new Error('not a member');
		return { userId, tenant };
	}

	/** A club with its admin signed up; returns the admin as an Actor. */
	async function club() {
		const slug = `club-${unique()}`;
		const { tenantId, invite } = await provisionTenant(
			db(),
			{
				slug,
				name: slug,
				defaultLocale: 'nl',
				adminName: 'Admin',
				adminEmail: `admin-${unique()}@example.org`
			},
			null
		);
		const { userId } = await acceptInvite(db(), invite.secret, null);
		return { slug, tenantId, admin: await actorFor(userId, slug) };
	}

	/** Adds a member, gives them an account, and grants the given role ids. */
	async function manager(admin: Actor, roleIds: string[]) {
		const id = await createMember(db(), admin, member('Manager', `mgr-${unique()}@example.org`));
		const invite = await inviteMember(db(), admin, id);
		const { userId } = await acceptInvite(db(), invite.secret, null);
		if (roleIds.length) await setMemberRoles(db(), admin, id, roleIds);
		return { membershipId: id, userId, actor: await actorFor(userId, admin.tenant.slug) };
	}

	async function customRole(tenantId: string, permissions: Permission[]): Promise<string> {
		return withTenant(db(), tenantId, async (trx) => {
			const { id } = await trx
				.insertInto('roles')
				.values({ tenant_id: tenantId, label_i18n: JSON.stringify({ nl: 'Eigen', en: 'Custom' }) })
				.returning('id')
				.executeTakeFirstOrThrow();
			if (permissions.length) {
				await trx
					.insertInto('role_permissions')
					.values(
						permissions.map((p) => ({ tenant_id: tenantId, role_id: id, permission_code: p }))
					)
					.execute();
			}
			return id;
		});
	}

	const roleByKey = async (admin: Actor, key: string) =>
		(await listRoles(db(), admin)).find((r) => r.labelKey === key)!.id;

	return { unique, member, actorFor, club, manager, customRole, roleByKey };
}
