// SPDX-License-Identifier: AGPL-3.0-or-later
// Assets, categories, locations, and lending out / checking in.
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	assetHistory,
	assetsHeldBy,
	assetStats,
	assignAsset,
	createAsset,
	deleteAsset,
	getAsset,
	listAssets,
	returnAsset,
	updateAsset,
	type AssetInput
} from '$lib/server/assets';
import type { DB } from '$lib/server/db/schema';
import {
	createCategory,
	createLocation,
	listCategories,
	renameCategory,
	setLocationArchived
} from '$lib/server/inventory';
import { createMember, setMemberStatus, type Actor } from '$lib/server/members';
import { appUrl, connect } from './db';
import { helpers } from './helpers';

let app: Kysely<DB>;
beforeAll(() => {
	app = connect(appUrl);
});
afterAll(async () => {
	await app.destroy();
});

const { member, club, manager, roleByKey } = helpers(() => app);

async function brassCategory(actor: Actor): Promise<string> {
	return (await listCategories(app, actor)).find((c) => c.labelKey === 'categories.brass')!.id;
}

function asset(categoryId: string, overrides: Partial<AssetInput> = {}): AssetInput {
	return {
		categoryId,
		tag: null,
		brand: 'Yamaha',
		model: 'YTR-2330',
		serialNumber: null,
		description: null,
		ownership: 'club',
		ownerMembershipId: null,
		status: 'active',
		purchaseYear: 2016,
		financials: { purchasePriceCents: 120000, insuredValueCents: 150000, insuredValueYear: 2024 },
		...overrides
	};
}

describe('assets', () => {
	it('new clubs get the default categories', async () => {
		const { admin } = await club();
		const categories = await listCategories(app, admin);
		expect(categories.map((c) => c.labelKey)).toContain('categories.brass');
		expect(categories).toHaveLength(10);
	});

	it('hides and protects financial fields from people without assets:view_financials', async () => {
		const { admin } = await club();
		const qm = await manager(admin, [await roleByKey(admin, 'roles.quartermaster')]);
		const im = await manager(admin, [await roleByKey(admin, 'roles.instrument_manager')]);
		const category = await brassCategory(admin);

		const id = await createAsset(app, qm.actor, asset(category));
		expect((await getAsset(app, qm.actor, id)).financials).toEqual({
			purchasePriceCents: 120000,
			insuredValueCents: 150000,
			insuredValueYear: 2024
		});
		expect((await getAsset(app, im.actor, id)).financials).toBeNull();

		// An instrument manager edits the asset; their (empty) money fields must not wipe the values.
		await updateAsset(
			app,
			im.actor,
			id,
			asset(category, {
				model: 'YTR-4335',
				financials: { purchasePriceCents: null, insuredValueCents: 1, insuredValueYear: null }
			})
		);
		const after = await getAsset(app, qm.actor, id);
		expect(after.model).toBe('YTR-4335');
		expect(after.financials?.purchasePriceCents).toBe(120000);
		expect(after.financials?.insuredValueCents).toBe(150000);

		// Nor can they set them when creating.
		const other = await createAsset(app, im.actor, asset(category, { brand: 'Bach' }));
		expect((await getAsset(app, qm.actor, other)).financials?.purchasePriceCents).toBeNull();
	});

	it('rejects duplicate tags and duplicate brand + serial combinations', async () => {
		const { admin } = await club();
		const category = await brassCategory(admin);
		await createAsset(app, admin, asset(category, { tag: 'TR-01', serialNumber: 'S123' }));
		await expect(createAsset(app, admin, asset(category, { tag: 'tr-01' }))).rejects.toThrow(
			'assets.errors.tag_taken'
		);
		await expect(
			createAsset(app, admin, asset(category, { brand: 'yamaha', serialNumber: 's123' }))
		).rejects.toThrow('assets.errors.serial_taken');
		// Same serial from another brand is another instrument.
		await createAsset(app, admin, asset(category, { brand: 'Bach', serialNumber: 'S123' }));
	});

	it("can't use another club's category or see another club's assets", async () => {
		const a = await club();
		const b = await club();
		const idB = await createAsset(app, b.admin, asset(await brassCategory(b.admin)));
		await expect(getAsset(app, a.admin, idB)).rejects.toThrow('errors.not_found');
		await expect(createAsset(app, a.admin, asset(await brassCategory(b.admin)))).rejects.toThrow(
			'assets.errors.category_invalid'
		);
	});

	it('filters by text (with LIKE wildcards escaped), category and status', async () => {
		const { admin } = await club();
		const category = await brassCategory(admin);
		const custom = await createCategory(app, admin, {
			kind: 'clothing',
			nameNl: 'Petten',
			nameEn: 'Caps'
		});
		await createAsset(app, admin, asset(category, { tag: '100%', model: 'Cornet' }));
		await createAsset(app, admin, asset(category, { tag: 'T-2', status: 'retired' }));
		await createAsset(app, admin, asset(custom, { brand: 'Kepie', model: null }));

		expect((await listAssets(app, admin, { q: 'corn' })).map((a) => a.tag)).toEqual(['100%']);
		expect(await listAssets(app, admin, { q: '%' })).toHaveLength(1);
		expect(await listAssets(app, admin, { categoryId: custom })).toHaveLength(1);
		expect(await listAssets(app, admin)).toHaveLength(2);
		expect(await listAssets(app, admin, { status: 'all' })).toHaveLength(3);
		expect(await listAssets(app, admin, { status: 'retired' })).toHaveLength(1);
	});

	it('deletes only assets without history', async () => {
		const { admin } = await club();
		const category = await brassCategory(admin);
		const fresh = await createAsset(app, admin, asset(category));
		await deleteAsset(app, admin, fresh);
		await expect(getAsset(app, admin, fresh)).rejects.toThrow('errors.not_found');

		const used = await createAsset(app, admin, asset(category));
		const depot = await createLocation(app, admin, 'Depot');
		await assignAsset(
			app,
			admin,
			used,
			{ kind: 'location', id: depot },
			{ conditionOut: null, notes: null }
		);
		await expect(deleteAsset(app, admin, used)).rejects.toThrow('assets.errors.has_history');
	});

	it('enforces permissions', async () => {
		const { admin } = await club();
		const viewer = await manager(admin, [await roleByKey(admin, 'roles.viewer')]);
		const category = await brassCategory(admin);
		const id = await createAsset(app, admin, asset(category));
		expect((await getAsset(app, viewer.actor, id)).id).toBe(id);
		await expect(createAsset(app, viewer.actor, asset(category))).rejects.toThrow(
			'errors.forbidden'
		);
		await expect(updateAsset(app, viewer.actor, id, asset(category))).rejects.toThrow(
			'errors.forbidden'
		);
		await expect(deleteAsset(app, viewer.actor, id)).rejects.toThrow('errors.forbidden');
		const m = await createMember(app, admin, member('Borrower'));
		await expect(
			assignAsset(
				app,
				viewer.actor,
				id,
				{ kind: 'member', id: m },
				{ conditionOut: null, notes: null }
			)
		).rejects.toThrow('errors.forbidden');
	});
});

describe('lending out and checking in', () => {
	const none = { conditionOut: null, notes: null };

	it('follows an asset from storage to a member and back', async () => {
		const { admin } = await club();
		const id = await createAsset(app, admin, asset(await brassCategory(admin)));
		const depot = await createLocation(app, admin, 'Depot');
		const kid = await createMember(app, admin, member('Kid Clarinet'));
		const other = await createMember(app, admin, member('Other'));

		await assignAsset(app, admin, id, { kind: 'location', id: depot }, none);
		expect((await getAsset(app, admin, id)).holder).toMatchObject({
			kind: 'location',
			name: 'Depot'
		});

		// From storage straight to a member: the storage assignment closes.
		await assignAsset(
			app,
			admin,
			id,
			{ kind: 'member', id: kid },
			{ conditionOut: 'Small dent', notes: null }
		);
		expect((await getAsset(app, admin, id)).holder).toMatchObject({
			kind: 'member',
			name: 'Kid Clarinet'
		});
		expect(await assetsHeldBy(app, admin, kid)).toHaveLength(1);
		expect((await assetStats(app, admin)).onLoan).toBe(1);

		// Lent out: can't go to someone else until it's back.
		await expect(assignAsset(app, admin, id, { kind: 'member', id: other }, none)).rejects.toThrow(
			'assignments.errors.already_out'
		);

		await returnAsset(app, admin, id, { conditionIn: 'Dent bigger', toLocationId: depot });
		expect((await getAsset(app, admin, id)).holder).toMatchObject({ kind: 'location', id: depot });
		expect(await assetsHeldBy(app, admin, kid)).toHaveLength(0);

		const history = await assetHistory(app, admin, id);
		expect(history.map((h) => h.holder.kind)).toEqual(['location', 'member', 'location']);
		expect(history[1]).toMatchObject({ conditionOut: 'Small dent', conditionIn: 'Dent bigger' });
		await expect(
			returnAsset(app, admin, id, { conditionIn: null, toLocationId: null })
		).rejects.toThrow('assignments.errors.not_out');
	});

	it('refuses retired assets, inactive members, other clubs’ members and archived locations', async () => {
		const { admin } = await club();
		const other = await club();
		const category = await brassCategory(admin);
		const retired = await createAsset(app, admin, asset(category, { status: 'retired' }));
		const id = await createAsset(app, admin, asset(category));
		const gone = await createMember(app, admin, member('Former'));
		await setMemberStatus(app, admin, gone, 'inactive');
		const elsewhere = await createMember(app, other.admin, member('Elsewhere'));
		const oldRoom = await createLocation(app, admin, 'Old room');
		await setLocationArchived(app, admin, oldRoom, true);
		const active = await createMember(app, admin, member('Active'));

		await expect(
			assignAsset(app, admin, retired, { kind: 'member', id: active }, none)
		).rejects.toThrow('assignments.errors.not_lendable');
		await expect(assignAsset(app, admin, id, { kind: 'member', id: gone }, none)).rejects.toThrow(
			'assignments.errors.member_not_active'
		);
		await expect(
			assignAsset(app, admin, id, { kind: 'member', id: elsewhere }, none)
		).rejects.toThrow('assignments.errors.member_not_active');
		await expect(
			assignAsset(app, admin, id, { kind: 'location', id: oldRoom }, none)
		).rejects.toThrow('assignments.errors.location_invalid');
	});

	it('lends an asset to only one person when two people try at once', async () => {
		const { admin } = await club();
		const id = await createAsset(app, admin, asset(await brassCategory(admin)));
		const members = await Promise.all(
			['A', 'B', 'C'].map((n) => createMember(app, admin, member(n)))
		);
		const results = await Promise.allSettled(
			members.map((m) => assignAsset(app, admin, id, { kind: 'member', id: m }, none))
		);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
	});

	it("won't archive a location while something is stored there", async () => {
		const { admin } = await club();
		const id = await createAsset(app, admin, asset(await brassCategory(admin)));
		const room = await createLocation(app, admin, 'Room');
		await assignAsset(app, admin, id, { kind: 'location', id: room }, none);
		await expect(setLocationArchived(app, admin, room, true)).rejects.toThrow(
			'locations.errors.in_use'
		);
		await expect(createLocation(app, admin, 'room')).rejects.toThrow('locations.errors.name_taken');
	});
});

describe('categories', () => {
	it('renaming a default category replaces its key with the club’s own names', async () => {
		const { admin } = await club();
		const brass = await brassCategory(admin);
		await renameCategory(app, admin, brass, {
			kind: 'instrument',
			nameNl: 'Koperwerk',
			nameEn: ''
		});
		const renamed = (await listCategories(app, admin)).find((c) => c.id === brass)!;
		expect(renamed).toMatchObject({ labelKey: null, labelI18n: { nl: 'Koperwerk' } });
	});
});
