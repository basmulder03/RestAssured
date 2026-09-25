// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, type RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { domainFailure, fieldErrors, formValues } from '$lib/server/forms';
import { requirePermission, requireTenant, requireUser } from '$lib/server/guards';
import {
	CategorySchema,
	createCategory,
	createLocation,
	listCategories,
	listLocations,
	LocationSchema,
	renameCategory,
	renameLocation,
	setCategoryArchived,
	setLocationArchived
} from '$lib/server/inventory';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

function actorOf({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(locals, url);
	return { userId: user.id, tenant: requireTenant(locals) };
}

export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, 'assets:edit');
	const actor = actorOf(event);
	const [categories, locations] = await Promise.all([
		listCategories(runtime().db, actor),
		listLocations(runtime().db, actor)
	]);
	return { categories, locations };
};

/** Runs a service call and reports success or the domain error, tagged with the form it came from. */
async function attempt(formId: string, fn: () => Promise<unknown>) {
	try {
		await fn();
	} catch (err) {
		return domainFailure(err, { formId });
	}
	return { formId, saved: true };
}

const id = (form: FormData) => String(form.get('id') ?? '');

export const actions: Actions = {
	createCategory: async (event) => {
		const values = formValues(await event.request.formData(), ['kind', 'nameNl', 'nameEn']);
		const parsed = v.safeParse(CategorySchema, values);
		if (!parsed.success) {
			return fail(400, { formId: 'newCategory', values, errors: fieldErrors(parsed.issues) });
		}
		return attempt('newCategory', () =>
			createCategory(runtime().db, actorOf(event), parsed.output)
		);
	},

	renameCategory: async (event) => {
		const form = await event.request.formData();
		const parsed = v.safeParse(CategorySchema, formValues(form, ['kind', 'nameNl', 'nameEn']));
		if (!parsed.success) return fail(400, { formId: id(form), error: 'errors.required' });
		return attempt(id(form), () =>
			renameCategory(runtime().db, actorOf(event), id(form), parsed.output)
		);
	},

	archiveCategory: async (event) => {
		const form = await event.request.formData();
		const archived = form.get('archived') === 'true';
		return attempt(id(form), () =>
			setCategoryArchived(runtime().db, actorOf(event), id(form), archived)
		);
	},

	createLocation: async (event) => {
		const values = formValues(await event.request.formData(), ['name']);
		const parsed = v.safeParse(LocationSchema, values);
		if (!parsed.success) {
			return fail(400, { formId: 'newLocation', values, errors: fieldErrors(parsed.issues) });
		}
		return attempt('newLocation', () =>
			createLocation(runtime().db, actorOf(event), parsed.output.name)
		);
	},

	renameLocation: async (event) => {
		const form = await event.request.formData();
		const parsed = v.safeParse(LocationSchema, formValues(form, ['name']));
		if (!parsed.success) return fail(400, { formId: id(form), error: 'errors.required' });
		return attempt(id(form), () =>
			renameLocation(runtime().db, actorOf(event), id(form), parsed.output.name)
		);
	},

	archiveLocation: async (event) => {
		const form = await event.request.formData();
		const archived = form.get('archived') === 'true';
		return attempt(id(form), () =>
			setLocationArchived(runtime().db, actorOf(event), id(form), archived)
		);
	}
};
