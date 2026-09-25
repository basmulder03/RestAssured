// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, redirect } from '@sveltejs/kit';
import { assetPageOptions, EMPTY_ASSET_FORM } from '$lib/server/asset-forms';
import { ASSET_FORM_FIELDS, createAsset, parseAssetForm } from '$lib/server/assets';
import { domainFailure, formValues } from '$lib/server/forms';
import { requirePermission, requireUser } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const tenant = requirePermission(locals, 'assets:create');
	const options = await assetPageOptions(runtime().db, { userId: user.id, tenant });
	return { ...options, values: EMPTY_ASSET_FORM };
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const user = requireUser(locals, url);
		const tenant = requirePermission(locals, 'assets:create');
		const values = formValues(await request.formData(), ASSET_FORM_FIELDS);
		const parsed = parseAssetForm(values, locals.locale);
		if (!parsed.ok) return fail(400, { values, errors: parsed.errors });
		let id: string;
		try {
			id = await createAsset(runtime().db, { userId: user.id, tenant }, parsed.input);
		} catch (err) {
			return domainFailure(err, { values });
		}
		redirect(303, `/t/${tenant.slug}/assets/${id}?created`);
	}
};
