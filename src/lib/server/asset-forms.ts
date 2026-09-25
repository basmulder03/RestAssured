// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared by the asset pages: options for pickers and form values from stored data.
import type { Kysely } from 'kysely';
import { moneyInputValue } from '../domain/money';
import type { Actor } from './actor';
import { memberOptions, type AssetDetail, type AssetFormValues } from './assets';
import type { DB } from './db/schema';
import { listCategories, listLocations } from './inventory';

export const EMPTY_ASSET_FORM: AssetFormValues = {
	categoryId: '',
	tag: '',
	brand: '',
	model: '',
	serialNumber: '',
	description: '',
	ownership: 'club',
	ownerMembershipId: '',
	status: 'active',
	purchaseYear: '',
	purchasePrice: '',
	insuredValue: '',
	insuredValueYear: ''
};

export function assetFormValues(a: AssetDetail, locale: string): AssetFormValues {
	return {
		categoryId: a.categoryId,
		tag: a.tag ?? '',
		brand: a.brand ?? '',
		model: a.model ?? '',
		serialNumber: a.serialNumber ?? '',
		description: a.description ?? '',
		ownership: a.ownership,
		ownerMembershipId: a.owner?.id ?? '',
		status: a.status,
		purchaseYear: a.purchaseYear?.toString() ?? '',
		purchasePrice: moneyInputValue(locale, a.financials?.purchasePriceCents ?? null),
		insuredValue: moneyInputValue(locale, a.financials?.insuredValueCents ?? null),
		insuredValueYear: a.financials?.insuredValueYear?.toString() ?? ''
	};
}

/** Categories, locations and members for the asset pages; each only when the actor may use it. */
export async function assetPageOptions(db: Kysely<DB>, actor: Actor) {
	const p = actor.tenant.permissions;
	const canPickMembers =
		p.has('assignments:manage') || p.has('assets:edit') || p.has('assets:create');
	const [categories, locations, members] = await Promise.all([
		listCategories(db, actor),
		listLocations(db, actor),
		canPickMembers ? memberOptions(db, actor) : Promise.resolve([])
	]);
	return {
		categories,
		locations: locations.filter((l) => !l.archived),
		members: members.map((m) => ({ id: m.id, name: m.name ?? '' }))
	};
}
