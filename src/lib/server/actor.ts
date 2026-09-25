// SPDX-License-Identifier: AGPL-3.0-or-later
// The acting user within a verified club context, and the checks every service call makes.
import type { Kysely, Transaction } from 'kysely';
import type { Permission } from '../domain/permissions';
import type { DB } from './db/schema';
import { withTenant } from './db/tenant';
import { DomainError } from './errors';
import type { TenantContext } from './tenancy';

export type Actor = { userId: string; tenant: TenantContext };

export function assertPermission(actor: Actor, permission: Permission): void {
	if (!actor.tenant.permissions.has(permission)) throw new DomainError('errors.forbidden');
}

export function assertWritable(actor: Actor): void {
	if (actor.tenant.status !== 'active') throw new DomainError('club.errors.not_writable');
}

/** Reads in the actor's club after a permission check. */
export function read<T>(
	db: Kysely<DB>,
	actor: Actor,
	permission: Permission,
	fn: (trx: Transaction<DB>) => Promise<T>
): Promise<T> {
	assertPermission(actor, permission);
	return withTenant(db, actor.tenant.id, fn);
}

/** Writes in the actor's club after the permission and writability checks. */
export function act<T>(
	db: Kysely<DB>,
	actor: Actor,
	permission: Permission,
	fn: (trx: Transaction<DB>) => Promise<T>
): Promise<T> {
	assertPermission(actor, permission);
	assertWritable(actor);
	return withTenant(db, actor.tenant.id, fn);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

/** Ids from URLs and forms: anything that isn't a UUID can't exist. */
export function assertId(id: string): void {
	if (!isUuid(id)) throw new DomainError('errors.not_found');
}
