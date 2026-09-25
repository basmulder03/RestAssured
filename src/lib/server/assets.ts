// SPDX-License-Identifier: AGPL-3.0-or-later
// Assets and assignments: who has what, and where it is (docs/SYSTEM_SPEC.md §2).
import { sql, type Kysely, type Transaction } from 'kysely';
import * as v from 'valibot';
import { parseMoney, parseYear } from '../domain/money';
import { act, assertId, assertPermission, isUuid, read, type Actor } from './actor';
import { auditTenant } from './audit';
import type { DB } from './db/schema';
import { DomainError } from './errors';

export const ASSET_STATUSES = ['active', 'in_repair', 'retired', 'lost', 'sold'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
/** Statuses an asset can be lent out in. */
const LENDABLE: readonly string[] = ['active', 'in_repair'];

// --- Input ---------------------------------------------------------------------------------

const text = (max: number) =>
	v.pipe(
		v.optional(v.string('errors.invalid'), ''),
		v.trim(),
		v.maxLength(max, 'errors.too_long'),
		v.transform((s) => (s === '' ? null : s))
	);

const uuid = v.pipe(v.string('errors.invalid'), v.uuid('errors.invalid'));

const AssetTextSchema = v.object({
	categoryId: v.pipe(v.string(), v.uuid('errors.required')),
	tag: text(50),
	brand: text(100),
	model: text(100),
	serialNumber: text(100),
	description: text(2000),
	ownership: v.picklist(['club', 'private'], 'errors.invalid'),
	ownerMembershipId: v.optional(v.union([v.literal(''), uuid]), ''),
	status: v.picklist(ASSET_STATUSES, 'errors.invalid')
});

export const ASSET_FORM_FIELDS = [
	'categoryId',
	'tag',
	'brand',
	'model',
	'serialNumber',
	'description',
	'ownership',
	'ownerMembershipId',
	'status',
	'purchaseYear',
	'purchasePrice',
	'insuredValue',
	'insuredValueYear'
] as const;
export type AssetFormValues = Record<(typeof ASSET_FORM_FIELDS)[number], string>;

export type AssetInput = {
	categoryId: string;
	tag: string | null;
	brand: string | null;
	model: string | null;
	serialNumber: string | null;
	description: string | null;
	ownership: 'club' | 'private';
	ownerMembershipId: string | null;
	status: AssetStatus;
	purchaseYear: number | null;
	/** Only applied when the actor may see financials; otherwise existing values are kept. */
	financials: {
		purchasePriceCents: number | null;
		insuredValueCents: number | null;
		insuredValueYear: number | null;
	};
};

/** Parses the asset form. Money is parsed in the user's locale (`1.250,-` vs `1,250`). */
export function parseAssetForm(
	values: AssetFormValues,
	locale: string
): { ok: true; input: AssetInput } | { ok: false; errors: Record<string, string> } {
	const errors: Record<string, string> = {};
	const parsed = v.safeParse(AssetTextSchema, values);
	if (!parsed.success) {
		for (const issue of parsed.issues) errors[v.getDotPath(issue) ?? 'form'] = issue.message;
	}
	const money = (field: 'purchasePrice' | 'insuredValue') => {
		const result = parseMoney(values[field], locale);
		if (result === 'invalid') errors[field] = 'errors.money_invalid';
		return result === 'invalid' ? null : result;
	};
	const year = (field: 'purchaseYear' | 'insuredValueYear') => {
		const result = parseYear(values[field]);
		if (result === 'invalid') errors[field] = 'errors.year_invalid';
		return result === 'invalid' ? null : result;
	};
	const purchasePriceCents = money('purchasePrice');
	const insuredValueCents = money('insuredValue');
	const purchaseYear = year('purchaseYear');
	const insuredValueYear = year('insuredValueYear');

	if (parsed.success && parsed.output.ownership === 'private' && !parsed.output.ownerMembershipId) {
		errors.ownerMembershipId = 'assets.errors.owner_required';
	}
	if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };

	const o = parsed.output;
	return {
		ok: true,
		input: {
			categoryId: o.categoryId,
			tag: o.tag,
			brand: o.brand,
			model: o.model,
			serialNumber: o.serialNumber,
			description: o.description,
			ownership: o.ownership,
			ownerMembershipId: o.ownership === 'private' ? o.ownerMembershipId || null : null,
			status: o.status,
			purchaseYear,
			financials: { purchasePriceCents, insuredValueCents, insuredValueYear }
		}
	};
}

// --- Views ---------------------------------------------------------------------------------

export type Holder =
	| { kind: 'member'; id: string; name: string | null; pseudonymId: string | null; since: string }
	| { kind: 'location'; id: string; name: string; since: string };

export type Financials = {
	purchasePriceCents: number | null;
	insuredValueCents: number | null;
	insuredValueYear: number | null;
};

export type AssetSummary = {
	id: string;
	categoryId: string;
	tag: string | null;
	brand: string | null;
	model: string | null;
	serialNumber: string | null;
	status: AssetStatus;
	ownership: 'club' | 'private';
	holder: Holder | null;
};

export type AssetDetail = AssetSummary & {
	description: string | null;
	purchaseYear: number | null;
	owner: { id: string; name: string | null; pseudonymId: string | null } | null;
	/** Null when the actor lacks assets:view_financials (ADR-0003). */
	financials: Financials | null;
	hasHistory: boolean;
};

const cents = (value: string | null): number | null => (value === null ? null : Number(value));

function holderOf(r: {
	a_since: Date | null;
	m_id: string | null;
	m_name: string | null;
	m_pseudonym: string | null;
	l_id: string | null;
	l_name: string | null;
}): Holder | null {
	if (!r.a_since) return null;
	const since = r.a_since.toISOString();
	if (r.m_id)
		return { kind: 'member', id: r.m_id, name: r.m_name, pseudonymId: r.m_pseudonym, since };
	if (r.l_id && r.l_name) return { kind: 'location', id: r.l_id, name: r.l_name, since };
	return null;
}

function assetsWithHolder(trx: Kysely<DB>, tenantId: string) {
	return trx
		.selectFrom('assets as a')
		.leftJoin('assignments as open', (j) =>
			j
				.onRef('open.tenant_id', '=', 'a.tenant_id')
				.onRef('open.asset_id', '=', 'a.id')
				.on('open.returned_at', 'is', null)
		)
		.leftJoin('tenant_memberships as m', (j) =>
			j.onRef('m.tenant_id', '=', 'open.tenant_id').onRef('m.id', '=', 'open.membership_id')
		)
		.leftJoin('locations as l', (j) =>
			j.onRef('l.tenant_id', '=', 'open.tenant_id').onRef('l.id', '=', 'open.location_id')
		)
		.where('a.tenant_id', '=', tenantId)
		.select([
			'a.id',
			'a.category_id',
			'a.tag',
			'a.brand',
			'a.model',
			'a.serial_number',
			'a.status',
			'a.ownership',
			'open.checked_out_at as a_since',
			'm.id as m_id',
			'm.display_name as m_name',
			'm.pseudonym_id as m_pseudonym',
			'l.id as l_id',
			'l.name as l_name'
		]);
}

export type AssetFilters = {
	q?: string;
	categoryId?: string;
	/** 'current' (default) hides retired, lost and sold assets. */
	status?: 'current' | 'all' | AssetStatus;
};

function likePattern(q: string): string {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listAssets(
	db: Kysely<DB>,
	actor: Actor,
	filters: AssetFilters = {}
): Promise<AssetSummary[]> {
	return read(db, actor, 'assets:view', async (trx) => {
		let query = assetsWithHolder(trx, actor.tenant.id);
		const q = filters.q?.trim();
		if (q) {
			const pattern = likePattern(q);
			query = query.where((eb) =>
				eb.or(
					['a.tag', 'a.brand', 'a.model', 'a.serial_number', 'a.description'].map((col) =>
						eb(sql.ref(col), 'ilike', pattern)
					)
				)
			);
		}
		if (isUuid(filters.categoryId)) {
			query = query.where('a.category_id', '=', filters.categoryId);
		}
		const status = filters.status ?? 'current';
		if (status === 'current') query = query.where('a.status', 'in', LENDABLE);
		else if (status !== 'all') query = query.where('a.status', '=', status);
		const rows = await query
			.orderBy(sql`lower(coalesce(a.tag, a.brand, a.model, ''))`)
			.limit(2000)
			.execute();
		return rows.map((r) => ({
			id: r.id,
			categoryId: r.category_id,
			tag: r.tag,
			brand: r.brand,
			model: r.model,
			serialNumber: r.serial_number,
			status: r.status as AssetStatus,
			ownership: r.ownership as 'club' | 'private',
			holder: holderOf(r)
		}));
	});
}

export async function getAsset(
	db: Kysely<DB>,
	actor: Actor,
	assetId: string
): Promise<AssetDetail> {
	assertId(assetId);
	return read(db, actor, 'assets:view', async (trx) => {
		const r = await assetsWithHolder(trx, actor.tenant.id)
			.leftJoin('tenant_memberships as owner', (j) =>
				j
					.onRef('owner.tenant_id', '=', 'a.tenant_id')
					.onRef('owner.id', '=', 'a.owner_membership_id')
			)
			.select([
				'a.description',
				'a.purchase_year',
				'a.purchase_price_cents',
				'a.insured_value_cents',
				'a.insured_value_year',
				'owner.id as owner_id',
				'owner.display_name as owner_name',
				'owner.pseudonym_id as owner_pseudonym',
				sql<boolean>`EXISTS (SELECT 1 FROM assignments h WHERE h.tenant_id = a.tenant_id AND h.asset_id = a.id)`.as(
					'has_history'
				)
			])
			.where('a.id', '=', assetId)
			.executeTakeFirst();
		if (!r) throw new DomainError('errors.not_found');
		const seesMoney = actor.tenant.permissions.has('assets:view_financials');
		return {
			id: r.id,
			categoryId: r.category_id,
			tag: r.tag,
			brand: r.brand,
			model: r.model,
			serialNumber: r.serial_number,
			status: r.status as AssetStatus,
			ownership: r.ownership as 'club' | 'private',
			holder: holderOf(r),
			description: r.description,
			purchaseYear: r.purchase_year,
			owner: r.owner_id
				? { id: r.owner_id, name: r.owner_name, pseudonymId: r.owner_pseudonym }
				: null,
			financials: seesMoney
				? {
						purchasePriceCents: cents(r.purchase_price_cents),
						insuredValueCents: cents(r.insured_value_cents),
						insuredValueYear: r.insured_value_year
					}
				: null,
			hasHistory: r.has_history
		};
	});
}

export type HistoryEntry = {
	id: string;
	holder: Holder;
	checkedOutAt: string;
	returnedAt: string | null;
	conditionOut: string | null;
	conditionIn: string | null;
	notes: string | null;
};

export async function assetHistory(
	db: Kysely<DB>,
	actor: Actor,
	assetId: string
): Promise<HistoryEntry[]> {
	assertId(assetId);
	return read(db, actor, 'assignments:view', async (trx) => {
		const rows = await trx
			.selectFrom('assignments as h')
			.leftJoin('tenant_memberships as m', (j) =>
				j.onRef('m.tenant_id', '=', 'h.tenant_id').onRef('m.id', '=', 'h.membership_id')
			)
			.leftJoin('locations as l', (j) =>
				j.onRef('l.tenant_id', '=', 'h.tenant_id').onRef('l.id', '=', 'h.location_id')
			)
			.select([
				'h.id',
				'h.checked_out_at',
				'h.returned_at',
				'h.condition_out',
				'h.condition_in',
				'h.notes',
				'm.id as m_id',
				'm.display_name as m_name',
				'm.pseudonym_id as m_pseudonym',
				'l.id as l_id',
				'l.name as l_name'
			])
			.where('h.tenant_id', '=', actor.tenant.id)
			.where('h.asset_id', '=', assetId)
			.orderBy('h.checked_out_at', 'desc')
			.limit(200)
			.execute();
		return rows.map((r) => ({
			id: r.id,
			holder: holderOf({ ...r, a_since: r.checked_out_at })!,
			checkedOutAt: r.checked_out_at.toISOString(),
			returnedAt: r.returned_at?.toISOString() ?? null,
			conditionOut: r.condition_out,
			conditionIn: r.condition_in,
			notes: r.notes
		}));
	});
}

/** Open assignments held by one member ("what does this person have?"). */
export async function assetsHeldBy(db: Kysely<DB>, actor: Actor, membershipId: string) {
	assertId(membershipId);
	assertPermission(actor, 'assets:view');
	return read(db, actor, 'assignments:view', async (trx) => {
		const rows = await trx
			.selectFrom('assignments as h')
			.innerJoin('assets as a', (j) =>
				j.onRef('a.tenant_id', '=', 'h.tenant_id').onRef('a.id', '=', 'h.asset_id')
			)
			.select(['a.id', 'a.tag', 'a.brand', 'a.model', 'a.serial_number', 'h.checked_out_at'])
			.where('h.tenant_id', '=', actor.tenant.id)
			.where('h.membership_id', '=', membershipId)
			.where('h.returned_at', 'is', null)
			.orderBy('h.checked_out_at')
			.execute();
		return rows.map((r) => ({
			id: r.id,
			tag: r.tag,
			brand: r.brand,
			model: r.model,
			serialNumber: r.serial_number,
			since: r.checked_out_at.toISOString()
		}));
	});
}

export async function assetStats(db: Kysely<DB>, actor: Actor) {
	return read(db, actor, 'assets:view', async (trx) => {
		const r = await trx
			.selectFrom('assets as a')
			.leftJoin('assignments as open', (j) =>
				j
					.onRef('open.tenant_id', '=', 'a.tenant_id')
					.onRef('open.asset_id', '=', 'a.id')
					.on('open.returned_at', 'is', null)
			)
			.select([
				sql<number>`count(*) FILTER (WHERE a.status IN ('active', 'in_repair'))::int`.as('current'),
				sql<number>`count(*) FILTER (WHERE open.membership_id IS NOT NULL)::int`.as('on_loan'),
				sql<number>`count(*) FILTER (WHERE a.status = 'in_repair')::int`.as('in_repair'),
				sql<number>`count(*) FILTER (WHERE a.status IN ('active', 'in_repair') AND open.id IS NULL)::int`.as(
					'unplaced'
				)
			])
			.where('a.tenant_id', '=', actor.tenant.id)
			.executeTakeFirstOrThrow();
		return { current: r.current, onLoan: r.on_loan, inRepair: r.in_repair, unplaced: r.unplaced };
	});
}

// --- Writes --------------------------------------------------------------------------------

/** Unique indexes → i18n codes. Anything else propagates. */
function mapUniqueViolation(err: unknown): never {
	const e = err as { code?: string; constraint?: string };
	if (e.code === '23505' && e.constraint === 'assets_tag_key')
		throw new DomainError('assets.errors.tag_taken');
	if (e.code === '23505' && e.constraint === 'assets_serial_key')
		throw new DomainError('assets.errors.serial_taken');
	throw err;
}

async function assertReferences(
	trx: Kysely<DB>,
	tenantId: string,
	input: AssetInput
): Promise<void> {
	const category = await trx
		.selectFrom('asset_categories')
		.select('archived_at')
		.where('tenant_id', '=', tenantId)
		.where('id', '=', input.categoryId)
		.executeTakeFirst();
	if (!category) throw new DomainError('assets.errors.category_invalid');
	if (input.ownerMembershipId) {
		const owner = await trx
			.selectFrom('tenant_memberships')
			.select('status')
			.where('tenant_id', '=', tenantId)
			.where('id', '=', input.ownerMembershipId)
			.executeTakeFirst();
		if (!owner || owner.status === 'anonymized')
			throw new DomainError('assets.errors.owner_required');
	}
}

export async function createAsset(
	db: Kysely<DB>,
	actor: Actor,
	input: AssetInput
): Promise<string> {
	const seesMoney = actor.tenant.permissions.has('assets:view_financials');
	return act(db, actor, 'assets:create', async (trx) => {
		await assertReferences(trx, actor.tenant.id, input);
		const { id } = await trx
			.insertInto('assets')
			.values({
				tenant_id: actor.tenant.id,
				category_id: input.categoryId,
				tag: input.tag,
				brand: input.brand,
				model: input.model,
				serial_number: input.serialNumber,
				description: input.description,
				ownership: input.ownership,
				owner_membership_id: input.ownerMembershipId,
				status: input.status,
				purchase_year: input.purchaseYear,
				...(seesMoney && {
					purchase_price_cents: input.financials.purchasePriceCents,
					insured_value_cents: input.financials.insuredValueCents,
					insured_value_year: input.financials.insuredValueYear
				})
			})
			.returning('id')
			.executeTakeFirstOrThrow()
			.catch(mapUniqueViolation);
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'asset.created',
			subjectType: 'asset',
			subjectId: id
		});
		return id;
	});
}

export async function updateAsset(
	db: Kysely<DB>,
	actor: Actor,
	assetId: string,
	input: AssetInput
): Promise<void> {
	assertId(assetId);
	const seesMoney = actor.tenant.permissions.has('assets:view_financials');
	await act(db, actor, 'assets:edit', async (trx) => {
		await assertReferences(trx, actor.tenant.id, input);
		const next = {
			category_id: input.categoryId,
			tag: input.tag,
			brand: input.brand,
			model: input.model,
			serial_number: input.serialNumber,
			description: input.description,
			ownership: input.ownership,
			owner_membership_id: input.ownerMembershipId,
			status: input.status,
			purchase_year: input.purchaseYear,
			// ADR-0003: someone who can't see financial fields can't overwrite them either.
			...(seesMoney && {
				purchase_price_cents: input.financials.purchasePriceCents,
				insured_value_cents: input.financials.insuredValueCents,
				insured_value_year: input.financials.insuredValueYear
			})
		};
		const current = await trx
			.selectFrom('assets')
			.selectAll()
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', assetId)
			.forUpdate()
			.executeTakeFirst();
		if (!current) throw new DomainError('errors.not_found');
		const changed = Object.keys(next).filter(
			(k) =>
				String(next[k as keyof typeof next] ?? '') !==
				String(current[k as keyof typeof current] ?? '')
		);
		if (changed.length === 0) return;
		await trx
			.updateTable('assets')
			.set({ ...next, updated_at: sql<Date>`now()` })
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', assetId)
			.execute()
			.catch(mapUniqueViolation);
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'asset.updated',
			subjectType: 'asset',
			subjectId: assetId,
			changedFields: Object.fromEntries(changed.map((k) => [k, true]))
		});
	});
}

/** Only assets without any history can be deleted; the rest are retired, lost or sold. */
export async function deleteAsset(db: Kysely<DB>, actor: Actor, assetId: string): Promise<void> {
	assertId(assetId);
	await act(db, actor, 'assets:delete', async (trx) => {
		const history = await trx
			.selectFrom('assignments')
			.select('id')
			.where('tenant_id', '=', actor.tenant.id)
			.where('asset_id', '=', assetId)
			.executeTakeFirst();
		if (history) throw new DomainError('assets.errors.has_history');
		const result = await trx
			.deleteFrom('assets')
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', assetId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) throw new DomainError('errors.not_found');
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'asset.deleted',
			subjectType: 'asset',
			subjectId: assetId
		});
	});
}

export type AssignTarget = { kind: 'member' | 'location'; id: string };

/** Form value `member:<uuid>` / `location:<uuid>` → target. */
export function parseTarget(value: string): AssignTarget | null {
	const parts = value.split(':');
	const [kind, id] = parts;
	return parts.length === 2 && (kind === 'member' || kind === 'location') && isUuid(id)
		? { kind, id }
		: null;
}

async function lockAsset(trx: Transaction<DB>, tenantId: string, assetId: string) {
	// Serialises concurrent checkouts of the same asset; the partial unique index backs it up.
	const asset = await trx
		.selectFrom('assets')
		.select(['id', 'status'])
		.where('tenant_id', '=', tenantId)
		.where('id', '=', assetId)
		.forUpdate()
		.executeTakeFirst();
	if (!asset) throw new DomainError('errors.not_found');
	const open = await trx
		.selectFrom('assignments')
		.select(['id', 'membership_id', 'location_id'])
		.where('tenant_id', '=', tenantId)
		.where('asset_id', '=', assetId)
		.where('returned_at', 'is', null)
		.executeTakeFirst();
	return { asset, open };
}

async function assertTarget(trx: Kysely<DB>, tenantId: string, target: AssignTarget) {
	if (target.kind === 'member') {
		const m = await trx
			.selectFrom('tenant_memberships')
			.select('status')
			.where('tenant_id', '=', tenantId)
			.where('id', '=', target.id)
			.executeTakeFirst();
		if (!m || m.status !== 'active') throw new DomainError('assignments.errors.member_not_active');
	} else {
		const l = await trx
			.selectFrom('locations')
			.select('archived_at')
			.where('tenant_id', '=', tenantId)
			.where('id', '=', target.id)
			.executeTakeFirst();
		if (!l || l.archived_at) throw new DomainError('assignments.errors.location_invalid');
	}
}

/**
 * Lends an asset to a member or puts it at a location. An asset stored somewhere can be lent
 * out directly (the storage assignment closes); one lent to a member must be returned first.
 */
export async function assignAsset(
	db: Kysely<DB>,
	actor: Actor,
	assetId: string,
	target: AssignTarget,
	details: { conditionOut: string | null; notes: string | null }
): Promise<void> {
	assertId(assetId);
	await act(db, actor, 'assignments:manage', async (trx) => {
		const { asset, open } = await lockAsset(trx, actor.tenant.id, assetId);
		if (!LENDABLE.includes(asset.status)) throw new DomainError('assignments.errors.not_lendable');
		if (open?.membership_id) throw new DomainError('assignments.errors.already_out');
		await assertTarget(trx, actor.tenant.id, target);
		if (open) {
			if (open.location_id === target.id) return;
			await trx
				.updateTable('assignments')
				.set({
					returned_at: sql<Date>`now()`,
					returned_by_membership_id: actor.tenant.membershipId
				})
				.where('tenant_id', '=', actor.tenant.id)
				.where('id', '=', open.id)
				.execute();
		}
		const { id } = await trx
			.insertInto('assignments')
			.values({
				tenant_id: actor.tenant.id,
				asset_id: assetId,
				membership_id: target.kind === 'member' ? target.id : null,
				location_id: target.kind === 'location' ? target.id : null,
				condition_out: details.conditionOut,
				notes: details.notes,
				issued_by_membership_id: actor.tenant.membershipId
			})
			.returning('id')
			.executeTakeFirstOrThrow();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: target.kind === 'member' ? 'asset.checked_out' : 'asset.stored',
			subjectType: 'asset',
			subjectId: assetId,
			changedFields: { assignment_id: id }
		});
	});
}

/** Checks an asset back in from a member, optionally straight into a storage location. */
export async function returnAsset(
	db: Kysely<DB>,
	actor: Actor,
	assetId: string,
	details: { conditionIn: string | null; toLocationId: string | null }
): Promise<void> {
	assertId(assetId);
	await act(db, actor, 'assignments:manage', async (trx) => {
		const { open } = await lockAsset(trx, actor.tenant.id, assetId);
		if (!open?.membership_id) throw new DomainError('assignments.errors.not_out');
		if (details.toLocationId) {
			await assertTarget(trx, actor.tenant.id, { kind: 'location', id: details.toLocationId });
		}
		await trx
			.updateTable('assignments')
			.set({
				returned_at: sql<Date>`now()`,
				condition_in: details.conditionIn,
				returned_by_membership_id: actor.tenant.membershipId
			})
			.where('tenant_id', '=', actor.tenant.id)
			.where('id', '=', open.id)
			.execute();
		if (details.toLocationId) {
			await trx
				.insertInto('assignments')
				.values({
					tenant_id: actor.tenant.id,
					asset_id: assetId,
					location_id: details.toLocationId,
					issued_by_membership_id: actor.tenant.membershipId
				})
				.execute();
		}
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'asset.returned',
			subjectType: 'asset',
			subjectId: assetId,
			changedFields: { assignment_id: open.id, stored: details.toLocationId !== null }
		});
	});
}

export const AssignDetailsSchema = v.object({
	conditionOut: text(500),
	notes: text(2000)
});

export const ReturnDetailsSchema = v.object({
	conditionIn: text(500),
	toLocationId: v.pipe(
		v.optional(v.string(), ''),
		v.transform((s) => (isUuid(s) ? s : null))
	)
});

/**
 * Active members to choose from when lending out or recording a private owner. Names only, and
 * available to anyone who can manage assignments or edit assets, even without members:view.
 */
export async function memberOptions(db: Kysely<DB>, actor: Actor) {
	const p = actor.tenant.permissions;
	if (!p.has('assignments:manage') && !p.has('assets:edit') && !p.has('assets:create')) {
		throw new DomainError('errors.forbidden');
	}
	return read(db, actor, 'assets:view', async (trx) =>
		trx
			.selectFrom('tenant_memberships')
			.select(['id', 'display_name as name'])
			.where('tenant_id', '=', actor.tenant.id)
			.where('status', '=', 'active')
			.orderBy(sql`lower(display_name)`)
			.execute()
	);
}
