// SPDX-License-Identifier: AGPL-3.0-or-later
// Club themes (ADR-0002): stored as typed values, served as a cached inline stylesheet.
import { sql, type Kysely } from 'kysely';
import {
	DEFAULT_THEME,
	themeCss,
	themeProblems,
	type Density,
	type Font,
	type Radius,
	type Theme
} from '$lib/domain/theme';
import { act, read, type Actor } from '$lib/server/actor';
import { auditTenant } from '$lib/server/audit';
import type { DB } from '$lib/server/db/schema';
import { withTenant } from '$lib/server/db/tenant';
import { DomainError } from '$lib/server/errors';

type Row = {
	color_primary: string;
	color_secondary: string;
	color_accent: string | null;
	radius: string;
	font_family: string;
	density: string;
};

function toTheme(r: Row): Theme {
	return {
		primary: r.color_primary,
		secondary: r.color_secondary,
		accent: r.color_accent,
		radius: r.radius as Radius,
		font: r.font_family as Font,
		density: r.density as Density
	};
}

const COLUMNS = [
	'color_primary',
	'color_secondary',
	'color_accent',
	'radius',
	'font_family',
	'density',
	'version'
] as const;

// Keyed by tenant; an entry is valid only for the version it was built from, so a save
// elsewhere (another process) is picked up on the next request.
const cache = new Map<string, { version: number; css: string }>();

/** The club's `:root{…}` block, or null for the default theme (nothing to inject). */
export async function tenantThemeCss(
	db: Kysely<DB>,
	tenantId: string,
	version: number
): Promise<string | null> {
	if (version === 0) return null;
	const hit = cache.get(tenantId);
	if (hit?.version === version) return hit.css;
	const row = await withTenant(db, tenantId, (trx) =>
		trx
			.selectFrom('theme_settings')
			.select(COLUMNS)
			.where('tenant_id', '=', tenantId)
			.executeTakeFirst()
	);
	if (!row) return null;
	const theme = toTheme(row);
	// Stored values passed validation on save; if they somehow don't, fall back to the default.
	const css = themeCss(themeProblems(theme).length ? DEFAULT_THEME : theme);
	cache.set(tenantId, { version: row.version, css });
	return css;
}

export async function getTheme(db: Kysely<DB>, actor: Actor): Promise<Theme> {
	return read(db, actor, 'tenant:manage_theme', async (trx) => {
		const row = await trx
			.selectFrom('theme_settings')
			.select(COLUMNS)
			.where('tenant_id', '=', actor.tenant.id)
			.executeTakeFirst();
		return row ? toTheme(row) : DEFAULT_THEME;
	});
}

export async function saveTheme(db: Kysely<DB>, actor: Actor, theme: Theme): Promise<void> {
	const problem = themeProblems(theme)[0];
	if (problem) throw new DomainError(problem.code, problem.params);
	await act(db, actor, 'tenant:manage_theme', async (trx) => {
		const values = {
			color_primary: theme.primary.toLowerCase(),
			color_secondary: theme.secondary.toLowerCase(),
			color_accent: theme.accent?.toLowerCase() ?? null,
			radius: theme.radius,
			font_family: theme.font,
			density: theme.density
		};
		await trx
			.insertInto('theme_settings')
			.values({ tenant_id: actor.tenant.id, ...values })
			.onConflict((oc) =>
				oc.column('tenant_id').doUpdateSet({
					...values,
					version: sql`theme_settings.version + 1`,
					updated_at: sql`now()`
				})
			)
			.execute();
		await auditTenant(trx, actor.tenant.id, actor.tenant.membershipId, {
			action: 'theme.updated',
			subjectType: 'theme',
			subjectId: actor.tenant.id,
			changedFields: values
		});
	});
}
