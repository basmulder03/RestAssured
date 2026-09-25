// SPDX-License-Identifier: AGPL-3.0-or-later
// Club member management (ADR-0001, ADR-0003, ADR-0004). Every function checks the actor's
// permissions itself; routes check too, but this is the layer the tests hold to account.
import { sql, type Kysely } from 'kysely';
import * as v from 'valibot';
import type { Permission } from '$lib/domain/permissions';
import { act, assertId, assertPermission, type Actor } from '$lib/server/actor';
import { auditTenant } from '$lib/server/audit';
import { issueToken, type TokenPurpose } from '$lib/server/auth/tokens';
import type { DB } from '$lib/server/db/schema';
import { withTenant } from '$lib/server/db/tenant';
import { DomainError } from '$lib/server/errors';

export type { Actor };

const optionalText = (max: number) =>
	v.pipe(
		v.optional(v.string('errors.invalid'), ''),
		v.trim(),
		v.maxLength(max, 'errors.too_long'),
		v.transform((s) => (s === '' ? null : s))
	);

// ADR-0005 data minimisation: only a name is required; everything else is optional.
export const MemberSchema = v.object({
	displayName: v.pipe(
		v.string('errors.invalid'),
		v.trim(),
		v.minLength(1, 'errors.required'),
		v.maxLength(200, 'errors.too_long')
	),
	email: v.pipe(
		optionalText(254),
		v.check((s) => s === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s), 'errors.email_invalid'),
		v.transform((s) => s?.toLowerCase() ?? null)
	),
	phone: optionalText(50),
	memberNumber: optionalText(50),
	notes: optionalText(2000)
});
export type MemberInput = v.InferOutput<typeof MemberSchema>;

export type MemberSummary = {
	id: string;
	displayName: string | null;
	pseudonymId: string | null;
	email: string | null;
	status: string;
	hasAccount: boolean;
	roleIds: string[];
};

export async function listMembers(db: Kysely<DB>, actor: Actor): Promise<MemberSummary[]> {
	assertPermission(actor, 'members:view');
	return withTenant(db, actor.tenant.id, async (trx) => {
		const rows = await trx
			.selectFrom('tenant_memberships as m')
			.leftJoin('membership_roles as mr', (j) =>
				j.onRef('mr.tenant_id', '=', 'm.tenant_id').onRef('mr.membership_id', '=', 'm.id')
			)
			.select([
				'm.id',
				'm.display_name',
				'm.pseudonym_id',
				'm.email',
				'm.status',
				'm.user_id',
				sql<
					string[]
				>`coalesce(array_agg(mr.role_id) FILTER (WHERE mr.role_id IS NOT NULL), '{}')`.as(
					'role_ids'
				)
			])
			.where('m.tenant_id', '=', actor.tenant.id)
			.groupBy(['m.tenant_id', 'm.id'])
			.orderBy(sql`lower(m.display_name)`)
			.execute();
		return rows.map((r) => ({
			id: r.id,
			displayName: r.display_name,
			pseudonymId: r.pseudonym_id,
			email: r.email,
			status: r.status,
			hasAccount: r.user_id !== null,
			roleIds: r.role_ids
		}));
	});
}

export async function getMember(db: Kysely<DB>, actor: Actor, membershipId: string) {
	assertPermission(actor, 'members:view');
	return withTenant(db, actor.tenant.id, async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		const roleIds = await trx
			.selectFrom('membership_roles')
			.select('role_id')
			.where('tenant_id', '=', actor.tenant.id)
			.where('membership_id', '=', membershipId)
			.execute();
		return {
			id: m.id,
			displayName: m.display_name,
			pseudonymId: m.pseudonym_id,
			email: m.email,
			phone: m.phone,
			memberNumber: m.member_number,
			notes: m.notes,
			status: m.status,
			hasAccount: m.user_id !== null,
			isSelf: m.user_id === actor.userId,
			roleIds: roleIds.map((r) => r.role_id)
		};
	});
}

async function findMember(trx: Kysely<DB>, tenantId: string, membershipId: string) {
	assertId(membershipId);
	const m = await trx
		.selectFrom('tenant_memberships')
		.selectAll()
		.where('tenant_id', '=', tenantId)
		.where('id', '=', membershipId)
		.executeTakeFirst();
	if (!m) throw new DomainError('errors.not_found');
	return m;
}

export async function createMember(
	db: Kysely<DB>,
	actor: Actor,
	input: MemberInput
): Promise<string> {
	return act(db, actor, 'members:manage', async (trx) => {
		const { id } = await trx
			.insertInto('tenant_memberships')
			.values({
				tenant_id: actor.tenant.id,
				display_name: input.displayName,
				email: input.email,
				phone: input.phone,
				member_number: input.memberNumber,
				notes: input.notes
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'member.created',
			subjectType: 'membership',
			subjectId: id,
			// ADR-0005: which fields were filled in, never their values.
			changedFields: Object.fromEntries(Object.entries(input).map(([k, val]) => [k, val !== null]))
		});
		return id;
	});
}

export async function updateMember(
	db: Kysely<DB>,
	actor: Actor,
	membershipId: string,
	input: MemberInput
): Promise<void> {
	await act(db, actor, 'members:manage', async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		if (m.status === 'anonymized') throw new DomainError('members.errors.anonymized');
		const next = {
			display_name: input.displayName,
			email: input.email,
			phone: input.phone,
			member_number: input.memberNumber,
			notes: input.notes
		};
		const changed = Object.keys(next).filter(
			(k) => next[k as keyof typeof next] !== m[k as keyof typeof next]
		);
		if (changed.length === 0) return;
		await trx
			.updateTable('tenant_memberships')
			.set({ ...next, updated_at: sql<Date>`now()` })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', membershipId)
			.execute();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'member.updated',
			subjectType: 'membership',
			subjectId: membershipId,
			changedFields: Object.fromEntries(changed.map((k) => [k, true]))
		});
	});
}

/** Active Tenant Admins with an account; the club must always keep at least one (ADR-0003). */
async function activeAdminCount(
	trx: Kysely<DB>,
	tenantId: string,
	excluding?: string
): Promise<number> {
	let query = trx
		.selectFrom('tenant_memberships as m')
		.innerJoin('membership_roles as mr', (j) =>
			j.onRef('mr.tenant_id', '=', 'm.tenant_id').onRef('mr.membership_id', '=', 'm.id')
		)
		.innerJoin('roles as r', (j) =>
			j.onRef('r.tenant_id', '=', 'mr.tenant_id').onRef('r.id', '=', 'mr.role_id')
		)
		.select(sql<number>`count(DISTINCT m.id)::int`.as('n'))
		.where('m.tenant_id', '=', tenantId)
		.where('m.status', '=', 'active')
		.where('m.user_id', 'is not', null)
		.where('r.is_system', '=', true);
	if (excluding) query = query.where('m.id', '<>', excluding);
	return (await query.executeTakeFirstOrThrow()).n;
}

async function isAdminMembership(trx: Kysely<DB>, tenantId: string, membershipId: string) {
	const row = await trx
		.selectFrom('membership_roles as mr')
		.innerJoin('roles as r', (j) =>
			j.onRef('r.tenant_id', '=', 'mr.tenant_id').onRef('r.id', '=', 'mr.role_id')
		)
		.select('r.id')
		.where('mr.tenant_id', '=', tenantId)
		.where('mr.membership_id', '=', membershipId)
		.where('r.is_system', '=', true)
		.executeTakeFirst();
	return row !== undefined;
}

export async function setMemberStatus(
	db: Kysely<DB>,
	actor: Actor,
	membershipId: string,
	status: 'active' | 'inactive'
): Promise<void> {
	await act(db, actor, 'members:manage', async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		if (m.status === 'anonymized') throw new DomainError('members.errors.anonymized');
		if (m.status === status) return;
		if (
			status === 'inactive' &&
			(await isAdminMembership(trx, actor.tenant.id, membershipId)) &&
			(await activeAdminCount(trx, actor.tenant.id, membershipId)) === 0
		) {
			throw new DomainError('members.errors.last_admin');
		}
		await trx
			.updateTable('tenant_memberships')
			.set({ status, updated_at: sql<Date>`now()` })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', membershipId)
			.execute();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'member.status_changed',
			subjectType: 'membership',
			subjectId: membershipId,
			changedFields: { status }
		});
	});
}

export type IssuedLink = { secret: string; expiresAt: Date; purpose: TokenPurpose };

/** Invites a member (who has an email address) to get an account (ADR-0004 §5). */
export async function inviteMember(
	db: Kysely<DB>,
	actor: Actor,
	membershipId: string
): Promise<IssuedLink> {
	return act(db, actor, 'members:invite', async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		if (m.status !== 'active') throw new DomainError('members.errors.not_active');
		if (m.user_id) throw new DomainError('members.errors.has_account');
		if (!m.email) throw new DomainError('members.errors.email_required');
		const link = await issueToken(trx, {
			purpose: 'invite',
			membership: { tenantId: actor.tenant.id, membershipId },
			issuedBy: actor.userId,
			issuedInTenantId: actor.tenant.id
		});
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'member.invited',
			subjectType: 'membership',
			subjectId: membershipId
		});
		return { ...link, purpose: 'invite' };
	});
}

/**
 * Tenant-admin-mediated login or password reset link (ADR-0004 §4). The admin never sees or sets
 * a password. Links for people in other clubs produce club-scoped sessions (see links.ts).
 */
export async function issueAccountLink(
	db: Kysely<DB>,
	actor: Actor,
	membershipId: string,
	purpose: 'magic_login' | 'password_reset'
): Promise<IssuedLink> {
	return act(db, actor, 'members:reset_password', async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		if (m.status !== 'active') throw new DomainError('members.errors.not_active');
		if (!m.user_id) throw new DomainError('members.errors.no_account');
		const user = await trx
			.selectFrom('users')
			.select(['platform_role', 'erased_at'])
			.where('id', '=', m.user_id)
			.executeTakeFirstOrThrow();
		if (user.erased_at) throw new DomainError('members.errors.no_account');
		if (user.platform_role) throw new DomainError('members.errors.platform_account');
		const link = await issueToken(trx, {
			purpose,
			userId: m.user_id,
			issuedBy: actor.userId,
			issuedInTenantId: actor.tenant.id
		});
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: purpose === 'magic_login' ? 'member.login_link_issued' : 'member.reset_link_issued',
			subjectType: 'membership',
			subjectId: membershipId
		});
		return { ...link, purpose };
	});
}

export type RoleSummary = {
	id: string;
	labelKey: string | null;
	labelI18n: Record<string, string> | null;
	isSystem: boolean;
	permissions: Permission[];
};

export async function listRoles(db: Kysely<DB>, actor: Actor): Promise<RoleSummary[]> {
	if (
		!actor.tenant.permissions.has('roles:view') &&
		!actor.tenant.permissions.has('members:view')
	) {
		throw new DomainError('errors.forbidden');
	}
	return withTenant(db, actor.tenant.id, (trx) => loadRoles(trx, actor.tenant.id));
}

async function loadRoles(trx: Kysely<DB>, tenantId: string): Promise<RoleSummary[]> {
	const rows = await trx
		.selectFrom('roles as r')
		.leftJoin('role_permissions as rp', (j) =>
			j.onRef('rp.tenant_id', '=', 'r.tenant_id').onRef('rp.role_id', '=', 'r.id')
		)
		.select([
			'r.id',
			'r.label_key',
			'r.label_i18n',
			'r.is_system',
			sql<
				string[]
			>`coalesce(array_agg(rp.permission_code) FILTER (WHERE rp.permission_code IS NOT NULL), '{}')`.as(
				'permissions'
			)
		])
		.where('r.tenant_id', '=', tenantId)
		.groupBy(['r.tenant_id', 'r.id'])
		.orderBy('r.is_system', 'desc')
		.orderBy('r.created_at')
		.execute();
	return rows.map((r) => ({
		id: r.id,
		labelKey: r.label_key,
		labelI18n: r.label_i18n as Record<string, string> | null,
		isSystem: r.is_system,
		permissions: r.permissions as Permission[]
	}));
}

/**
 * Replaces a member's roles. ADR-0003 guards: only Tenant Admins grant or revoke the Tenant Admin
 * role; nobody grants a role carrying permissions they don't hold themselves; the club keeps at
 * least one active admin.
 */
export async function setMemberRoles(
	db: Kysely<DB>,
	actor: Actor,
	membershipId: string,
	roleIds: string[]
): Promise<void> {
	await act(db, actor, 'roles:manage', async (trx) => {
		const m = await findMember(trx, actor.tenant.id, membershipId);
		if (m.status === 'anonymized') throw new DomainError('members.errors.anonymized');
		const roles = await loadRoles(trx, actor.tenant.id);
		const byId = new Map(roles.map((r) => [r.id, r]));
		const wanted = new Set(roleIds);
		for (const id of wanted) if (!byId.has(id)) throw new DomainError('errors.invalid');

		const current = new Set(
			(
				await trx
					.selectFrom('membership_roles')
					.select('role_id')
					.where('tenant_id', '=', actor.tenant.id)
					.where('membership_id', '=', membershipId)
					.execute()
			).map((r) => r.role_id)
		);
		const added = [...wanted].filter((id) => !current.has(id));
		const removed = [...current].filter((id) => !wanted.has(id));
		if (added.length === 0 && removed.length === 0) return;

		for (const id of [...added, ...removed]) {
			const role = byId.get(id)!;
			if (role.isSystem && !actor.tenant.isTenantAdmin)
				throw new DomainError('members.errors.admin_role_only');
		}
		for (const id of added) {
			const role = byId.get(id)!;
			if (
				!actor.tenant.isTenantAdmin &&
				role.permissions.some((p) => !actor.tenant.permissions.has(p))
			) {
				throw new DomainError('members.errors.escalation');
			}
		}
		const removesAdmin = removed.some((id) => byId.get(id)!.isSystem);
		if (removesAdmin && (await activeAdminCount(trx, actor.tenant.id, membershipId)) === 0) {
			throw new DomainError('members.errors.last_admin');
		}

		if (removed.length) {
			await trx
				.deleteFrom('membership_roles')
				.where('tenant_id', '=', actor.tenant.id)
				.where('membership_id', '=', membershipId)
				.where('role_id', 'in', removed)
				.execute();
		}
		if (added.length) {
			await trx
				.insertInto('membership_roles')
				.values(
					added.map((role_id) => ({
						tenant_id: actor.tenant.id,
						membership_id: membershipId,
						role_id
					}))
				)
				.execute();
		}
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'member.roles_changed',
			subjectType: 'membership',
			subjectId: membershipId,
			changedFields: { added, removed }
		});
	});
}
