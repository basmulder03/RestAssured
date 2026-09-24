// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0005/0017: audit entries hold ids and field *names*; never personal data values.
import type { Kysely } from 'kysely';
import type { DB } from './db/schema';

type Entry = {
	action: string;
	subjectType: string;
	subjectId?: string | null;
	changedFields?: Record<string, unknown>;
};

/** Must run inside a transaction scoped to `tenantId` (withTenant / setTenant). */
export async function auditTenant(
	trx: Kysely<DB>,
	tenantId: string,
	actorMembershipId: string | null,
	entry: Entry
): Promise<void> {
	await trx
		.insertInto('audit_log')
		.values({
			tenant_id: tenantId,
			actor_membership_id: actorMembershipId,
			action: entry.action,
			subject_type: entry.subjectType,
			subject_id: entry.subjectId ?? null,
			changed_fields: JSON.stringify(entry.changedFields ?? {})
		})
		.execute();
}

export async function auditPlatform(
	db: Kysely<DB>,
	actorUserId: string | null,
	entry: Entry
): Promise<void> {
	await db
		.insertInto('platform_audit_log')
		.values({
			actor_user_id: actorUserId,
			action: entry.action,
			subject_type: entry.subjectType,
			subject_id: entry.subjectId ?? null,
			changed_fields: JSON.stringify(entry.changedFields ?? {})
		})
		.execute();
}
