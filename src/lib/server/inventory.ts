// SPDX-License-Identifier: AGPL-3.0-or-later
// Asset categories and storage locations of a club.
import { sql, type Kysely } from 'kysely';
import * as v from 'valibot';
import { act, assertId, read, type Actor } from './actor';
import { auditTenant } from './audit';
import type { DB } from './db/schema';
import { DomainError } from './errors';

export const CATEGORY_KINDS = ['instrument', 'clothing', 'accessory', 'case'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export type Category = {
	id: string;
	kind: CategoryKind;
	labelKey: string | null;
	labelI18n: Record<string, string> | null;
	archived: boolean;
};

export type Location = { id: string; name: string; archived: boolean };

const name = v.pipe(
	v.string('errors.invalid'),
	v.trim(),
	v.minLength(1, 'errors.required'),
	v.maxLength(100, 'errors.too_long')
);

// ADR-0007 §5: club-defined labels in both languages; one may be left empty.
export const CategorySchema = v.pipe(
	v.object({
		kind: v.picklist(CATEGORY_KINDS, 'errors.invalid'),
		nameNl: v.pipe(v.string(), v.trim(), v.maxLength(100, 'errors.too_long')),
		nameEn: v.pipe(v.string(), v.trim(), v.maxLength(100, 'errors.too_long'))
	}),
	v.forward(
		v.check((c) => c.nameNl !== '' || c.nameEn !== '', 'errors.required'),
		['nameNl']
	)
);
export type CategoryInput = v.InferOutput<typeof CategorySchema>;

export const LocationSchema = v.object({ name });

export async function listCategories(db: Kysely<DB>, actor: Actor): Promise<Category[]> {
	return read(db, actor, 'assets:view', async (trx) => {
		const rows = await trx
			.selectFrom('asset_categories')
			.select(['id', 'kind', 'label_key', 'label_i18n', 'archived_at'])
			.where('tenant_id', '=', actor.tenant.id)
			.orderBy('sort_order')
			.orderBy('created_at')
			.execute();
		return rows.map((r) => ({
			id: r.id,
			kind: r.kind as CategoryKind,
			labelKey: r.label_key,
			labelI18n: r.label_i18n as Record<string, string> | null,
			archived: r.archived_at !== null
		}));
	});
}

function labelI18n(input: CategoryInput): string {
	return JSON.stringify(
		Object.fromEntries(
			[
				['nl', input.nameNl],
				['en', input.nameEn]
			].filter(([, value]) => value !== '')
		)
	);
}

export async function createCategory(db: Kysely<DB>, actor: Actor, input: CategoryInput) {
	return act(db, actor, 'assets:edit', async (trx) => {
		const { max } = await trx
			.selectFrom('asset_categories')
			.select(sql<number>`coalesce(max(sort_order), 0)::int`.as('max'))
			.where('tenant_id', '=', actor.tenant.id)
			.executeTakeFirstOrThrow();
		const { id } = await trx
			.insertInto('asset_categories')
			.values({
				tenant_id: actor.tenant.id,
				kind: input.kind,
				label_i18n: labelI18n(input),
				sort_order: max + 10
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'category.created',
			subjectType: 'asset_category',
			subjectId: id
		});
		return id;
	});
}

/** Renaming a default category replaces its translated key with the club's own names. */
export async function renameCategory(
	db: Kysely<DB>,
	actor: Actor,
	categoryId: string,
	input: CategoryInput
): Promise<void> {
	assertId(categoryId);
	await act(db, actor, 'assets:edit', async (trx) => {
		const result = await trx
			.updateTable('asset_categories')
			.set({ label_i18n: labelI18n(input), label_key: null, kind: input.kind })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', categoryId)
			.executeTakeFirst();
		if (result.numUpdatedRows === 0n) throw new DomainError('errors.not_found');
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'category.updated',
			subjectType: 'asset_category',
			subjectId: categoryId
		});
	});
}

/** Archived categories keep their assets but can't be chosen for new ones. */
export async function setCategoryArchived(
	db: Kysely<DB>,
	actor: Actor,
	categoryId: string,
	archived: boolean
): Promise<void> {
	assertId(categoryId);
	await act(db, actor, 'assets:edit', async (trx) => {
		const result = await trx
			.updateTable('asset_categories')
			.set({ archived_at: archived ? sql<Date>`now()` : null })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', categoryId)
			.executeTakeFirst();
		if (result.numUpdatedRows === 0n) throw new DomainError('errors.not_found');
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: archived ? 'category.archived' : 'category.restored',
			subjectType: 'asset_category',
			subjectId: categoryId
		});
	});
}

export async function listLocations(db: Kysely<DB>, actor: Actor): Promise<Location[]> {
	return read(db, actor, 'assets:view', async (trx) => {
		const rows = await trx
			.selectFrom('locations')
			.select(['id', 'name', 'archived_at'])
			.where('tenant_id', '=', actor.tenant.id)
			.orderBy(sql`lower(name)`)
			.execute();
		return rows.map((r) => ({ id: r.id, name: r.name, archived: r.archived_at !== null }));
	});
}

async function assertNameFree(
	trx: Kysely<DB>,
	tenantId: string,
	locationName: string,
	except?: string
) {
	let query = trx
		.selectFrom('locations')
		.select('id')
		.where('tenant_id', '=', tenantId)
		.where('archived_at', 'is', null)
		.where(sql<string>`lower(name)`, '=', locationName.toLowerCase());
	if (except) query = query.where('id', '<>', except);
	if (await query.executeTakeFirst()) {
		throw new DomainError('locations.errors.name_taken', { name: locationName });
	}
}

export async function createLocation(db: Kysely<DB>, actor: Actor, locationName: string) {
	return act(db, actor, 'assets:edit', async (trx) => {
		await assertNameFree(trx, actor.tenant.id, locationName);
		const { id } = await trx
			.insertInto('locations')
			.values({ tenant_id: actor.tenant.id, name: locationName })
			.returning('id')
			.executeTakeFirstOrThrow();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'location.created',
			subjectType: 'location',
			subjectId: id
		});
		return id;
	});
}

export async function renameLocation(
	db: Kysely<DB>,
	actor: Actor,
	locationId: string,
	locationName: string
): Promise<void> {
	assertId(locationId);
	await act(db, actor, 'assets:edit', async (trx) => {
		await assertNameFree(trx, actor.tenant.id, locationName, locationId);
		const result = await trx
			.updateTable('locations')
			.set({ name: locationName })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', locationId)
			.executeTakeFirst();
		if (result.numUpdatedRows === 0n) throw new DomainError('errors.not_found');
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'location.updated',
			subjectType: 'location',
			subjectId: locationId
		});
	});
}

/** A location can only be archived once nothing is stored there. */
export async function setLocationArchived(
	db: Kysely<DB>,
	actor: Actor,
	locationId: string,
	archived: boolean
): Promise<void> {
	assertId(locationId);
	await act(db, actor, 'assets:edit', async (trx) => {
		const location = await trx
			.selectFrom('locations')
			.select(['id', 'name'])
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', locationId)
			.executeTakeFirst();
		if (!location) throw new DomainError('errors.not_found');
		if (archived) {
			const inUse = await trx
				.selectFrom('assignments')
				.select('id')
				.where('tenant_id', '=', actor.tenant.id)
				.where('location_id', '=', locationId)
				.where('returned_at', 'is', null)
				.executeTakeFirst();
			if (inUse) throw new DomainError('locations.errors.in_use');
		} else {
			await assertNameFree(trx, actor.tenant.id, location.name, locationId);
		}
		await trx
			.updateTable('locations')
			.set({ archived_at: archived ? sql<Date>`now()` : null })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', locationId)
			.execute();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: archived ? 'location.archived' : 'location.restored',
			subjectType: 'location',
			subjectId: locationId
		});
	});
}
