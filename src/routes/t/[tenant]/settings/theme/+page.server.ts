// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, type RequestEvent } from '@sveltejs/kit';
import {
	DEFAULT_THEME,
	DENSITIES,
	FONTS,
	RADII,
	themeProblems,
	type Theme
} from '$lib/domain/theme';
import { domainFailure, formValues } from '$lib/server/forms';
import { requirePermission, requireUser } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import { getTheme, saveTheme } from '$lib/server/theming';
import type { Actions, PageServerLoad } from './$types';

function actorOf({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(locals, url);
	return { userId: user.id, tenant: requirePermission(locals, 'tenant:manage_theme') };
}

export const load: PageServerLoad = async (event) => ({
	theme: await getTheme(runtime().db, actorOf(event)),
	options: {
		radii: Object.keys(RADII),
		fonts: Object.keys(FONTS),
		densities: Object.keys(DENSITIES)
	}
});

const FIELDS = [
	'primary',
	'secondary',
	'useAccent',
	'accent',
	'radius',
	'font',
	'density'
] as const;

export const actions: Actions = {
	save: async (event) => {
		const actor = actorOf(event);
		const v = formValues(await event.request.formData(), FIELDS);
		const theme = {
			primary: v.primary,
			secondary: v.secondary,
			accent: v.useAccent === 'on' ? v.accent : null,
			radius: v.radius,
			font: v.font,
			density: v.density
		} as Theme;
		const problems = themeProblems(theme);
		if (problems.length) {
			return fail(400, {
				theme,
				errors: Object.fromEntries(problems.map((p) => [p.field, p.code])),
				errorParams: Object.fromEntries(problems.map((p) => [p.field, p.params ?? {}]))
			});
		}
		try {
			await saveTheme(runtime().db, actor, theme);
		} catch (err) {
			return domainFailure(err, { theme });
		}
		return { saved: true };
	},

	reset: async (event) => {
		try {
			await saveTheme(runtime().db, actorOf(event), DEFAULT_THEME);
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: true, reset: true };
	}
};
