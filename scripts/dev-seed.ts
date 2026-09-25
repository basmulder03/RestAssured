// SPDX-License-Identifier: AGPL-3.0-or-later
// Local development only: known accounts and demo data, so you can sign in and click around.
// Refuses to run against anything but a database on this machine. Idempotent: re-running
// resets the demo passwords and leaves existing data alone.
import type { Kysely } from 'kysely';
import { assignAsset, createAsset, type AssetInput } from '../src/lib/server/assets';
import { acceptInvite } from '../src/lib/server/auth/links';
import { hashPassword } from '../src/lib/server/auth/password';
import { createDb } from '../src/lib/server/db/index';
import type { DB } from '../src/lib/server/db/schema';
import { withTenant } from '../src/lib/server/db/tenant';
import { createLocation, listCategories } from '../src/lib/server/inventory';
import {
	createMember,
	inviteMember,
	listRoles,
	setMemberRoles,
	type Actor
} from '../src/lib/server/members';
import { createSuperAdmin, provisionTenant } from '../src/lib/server/platform';
import { resolveTenantContext } from '../src/lib/server/tenancy';
import { loadDotEnv } from './env';

export const DEV_PASSWORD = 'restassured-dev';
const SUPER = 'super@restassured.test';
const ADMIN = 'admin@restassured.test';
const QM = 'quartermaster@restassured.test';

loadDotEnv();
const url = process.env.RA_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
	console.error('dev:seed only runs against a local database (RA_DATABASE_URL on localhost).');
	process.exit(1);
}
const db = createDb(url, 2);

async function userId(email: string): Promise<string | undefined> {
	return (await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst())
		?.id;
}

async function setPassword(email: string): Promise<void> {
	await db
		.updateTable('users')
		.set({ password_hash: await hashPassword(DEV_PASSWORD), credential_scope_tenant_id: null })
		.where('email', '=', email)
		.execute();
}

async function actor(uid: string, slug: string): Promise<Actor> {
	const tenant = await resolveTenantContext(db, uid, slug, null);
	if (!tenant) throw new Error(`${uid} is not a member of ${slug}`);
	return { userId: uid, tenant };
}

async function club(slug: string, name: string, superId: string): Promise<Actor> {
	const exists = await db
		.selectFrom('tenants')
		.select('id')
		.where('slug', '=', slug)
		.executeTakeFirst();
	if (!exists) {
		const { invite } = await provisionTenant(
			db,
			{ slug, name, defaultLocale: 'nl', adminName: 'Anna de Beheerder', adminEmail: ADMIN },
			superId
		);
		await acceptInvite(db, invite.secret, (await userId(ADMIN)) ?? null);
		console.log(`Created club "${name}" (/t/${slug})`);
	}
	return actor((await userId(ADMIN))!, slug);
}

async function demoData(admin: Actor): Promise<void> {
	// Row-level security: this check needs the club's context like any other tenant query.
	const already = await withTenant(db, admin.tenant.id, (trx) =>
		trx
			.selectFrom('assets')
			.select('id')
			.where('tenant_id', '=', admin.tenant.id)
			.executeTakeFirst()
	);
	if (already) return;

	const roles = await listRoles(db, admin);
	const role = (key: string) => roles.find((r) => r.labelKey === key)!.id;

	const qmId = await createMember(db, admin, {
		displayName: 'Quinten Materiaal',
		email: QM,
		phone: null,
		memberNumber: '1002',
		notes: null
	});
	const invite = await inviteMember(db, admin, qmId);
	await acceptInvite(db, invite.secret, null);
	await setMemberRoles(db, admin, qmId, [role('roles.quartermaster')]);

	const names = [
		'Sanne Jansen',
		'Daan de Vries',
		'Lotte Bakker',
		'Milan Visser',
		'Emma Smit',
		'Noah Mulder'
	];
	const members: string[] = [];
	for (const [i, displayName] of names.entries()) {
		members.push(
			await createMember(db, admin, {
				displayName,
				email: null,
				phone: null,
				memberNumber: String(1010 + i),
				notes: null
			})
		);
	}

	const rehearsal = await createLocation(db, admin, 'Repetitielokaal');
	const depot = await createLocation(db, admin, 'Depot zolder');
	const categories = await listCategories(db, admin);
	const cat = (key: string) => categories.find((c) => c.labelKey === key)!.id;

	const asset = (
		category: string,
		tag: string,
		brand: string | null,
		model: string | null,
		serial: string | null,
		year: number | null,
		price: number | null,
		insured: number | null
	): AssetInput => ({
		categoryId: cat(category),
		tag,
		brand,
		model,
		serialNumber: serial,
		description: null,
		ownership: 'club',
		ownerMembershipId: null,
		status: 'active',
		purchaseYear: year,
		financials: {
			purchasePriceCents: price === null ? null : price * 100,
			insuredValueCents: insured === null ? null : insured * 100,
			insuredValueYear: insured === null ? null : 2024
		}
	});

	const items: [AssetInput, { kind: 'member' | 'location'; id: string } | null][] = [
		[
			asset('categories.brass', 'TR-01', 'Yamaha', 'YTR-2330', 'F41337', 2016, 1200, 1500),
			{ kind: 'member', id: members[0]! }
		],
		[
			asset('categories.brass', 'TR-02', 'Bach', 'TR300H2', 'B80211', 2019, 950, 1100),
			{ kind: 'location', id: rehearsal }
		],
		[
			asset('categories.brass', 'BU-01', 'Besson', 'BE2051', '872301', 2011, 1850, 2200),
			{ kind: 'member', id: members[1]! }
		],
		[
			asset('categories.brass', 'TB-01', 'Conn', '88H', 'N12345', 2008, 2600, 3200),
			{ kind: 'location', id: depot }
		],
		[
			asset('categories.brass', 'EU-01', 'Besson', 'Prestige 2052', '883410', 2014, 6400, 7000),
			{ kind: 'member', id: members[2]! }
		],
		[
			asset('categories.brass', 'TU-01', 'Miraphone', '186', '51234', 1998, 5200, 9500),
			{ kind: 'location', id: depot }
		],
		[
			asset('categories.woodwind', 'FL-01', 'Pearl', 'PF-505', 'P9981', 2020, 780, 800),
			{ kind: 'member', id: members[3]! }
		],
		[
			asset('categories.woodwind', 'KL-01', 'Buffet Crampon', 'E11', 'BC55321', 2017, 1150, 1200),
			null
		],
		[
			asset('categories.saxophones', 'AS-01', 'Yamaha', 'YAS-280', 'EG12345', 2018, 1100, 1250),
			{ kind: 'location', id: rehearsal }
		],
		[
			asset('categories.percussion', 'SD-01', 'Pearl', 'Championship', null, 2013, 890, 1000),
			{ kind: 'location', id: rehearsal }
		],
		[
			asset('categories.percussion', 'BK-01', 'Zildjian', 'A 18" crash', null, 2015, 320, 350),
			{ kind: 'location', id: rehearsal }
		],
		[
			asset('categories.uniforms', 'UN-M-01', null, 'Jasje maat M', null, 2012, 280, null),
			{ kind: 'member', id: members[4]! }
		],
		[
			asset('categories.uniforms', 'UN-L-01', null, 'Jasje maat L', null, 2012, 280, null),
			{ kind: 'location', id: depot }
		],
		[
			asset('categories.music_stands', 'LS-01', 'K&M', '10065', null, 2021, 45, null),
			{ kind: 'location', id: rehearsal }
		],
		[
			asset('categories.cases', 'KO-01', 'Gewa', 'Trompetkoffer', null, 2016, 120, null),
			{ kind: 'member', id: members[0]! }
		]
	];
	for (const [input, target] of items) {
		const id = await createAsset(db, admin, input);
		if (target) await assignAsset(db, admin, id, target, { conditionOut: null, notes: null });
	}
	console.log(`Added demo members, locations and ${items.length} assets to ${admin.tenant.name}`);
}

try {
	const { userId: superId } = await createSuperAdmin(db, SUPER);
	const demo = await club('demo', 'Harmonie Demo', superId);
	await club('drumband-demo', 'Drumband Demo', superId);
	await demoData(demo);
	for (const email of [SUPER, ADMIN, QM]) await setPassword(email);

	const origin = process.env.ORIGIN ?? 'http://localhost:5173';
	console.log(`
Dev sign-in (password for all: ${DEV_PASSWORD})  ${origin}/login
  ${SUPER.padEnd(32)} Super Admin (/platform)
  ${ADMIN.padEnd(32)} admin of Harmonie Demo and Drumband Demo
  ${QM.padEnd(32)} quartermaster of Harmonie Demo`);
} finally {
	await db.destroy();
}
