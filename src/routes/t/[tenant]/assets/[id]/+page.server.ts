// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { assetFormValues, assetPageOptions } from '$lib/server/asset-forms';
import {
	ASSET_FORM_FIELDS,
	assetHistory,
	assignAsset,
	AssignDetailsSchema,
	deleteAsset,
	getAsset,
	parseAssetForm,
	parseTarget,
	returnAsset,
	ReturnDetailsSchema,
	updateAsset
} from '$lib/server/assets';
import { domainFailure, formValues, loadFailure } from '$lib/server/forms';
import { requireTenant, requireUser } from '$lib/server/guards';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

// Permissions are enforced in $lib/server/assets; the actor carries the verified club context.
function actorOf({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(locals, url);
	return { userId: user.id, tenant: requireTenant(locals) };
}

export const load: PageServerLoad = async (event) => {
	const actor = actorOf(event);
	const { db } = runtime();
	try {
		const asset = await getAsset(db, actor, event.params.id);
		const [history, options] = await Promise.all([
			actor.tenant.permissions.has('assignments:view')
				? assetHistory(db, actor, asset.id)
				: Promise.resolve(null),
			assetPageOptions(db, actor)
		]);
		return {
			asset,
			history,
			...options,
			values: assetFormValues(asset, event.locals.locale),
			created: event.url.searchParams.has('created')
		};
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	update: async (event) => {
		const values = formValues(await event.request.formData(), ASSET_FORM_FIELDS);
		const parsed = parseAssetForm(values, event.locals.locale);
		if (!parsed.ok) return fail(400, { values, errors: parsed.errors });
		try {
			await updateAsset(runtime().db, actorOf(event), event.params.id, parsed.input);
		} catch (err) {
			return domainFailure(err, { values });
		}
		return { saved: 'assets.saved' };
	},

	assign: async (event) => {
		const form = await event.request.formData();
		const target = parseTarget(String(form.get('target') ?? ''));
		if (!target) return fail(400, { error: 'assignments.errors.target_required' });
		const details = v.parse(AssignDetailsSchema, formValues(form, ['conditionOut', 'notes']));
		try {
			await assignAsset(runtime().db, actorOf(event), event.params.id, target, details);
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: target.kind === 'member' ? 'assignments.lent' : 'assignments.stored' };
	},

	return: async (event) => {
		const form = await event.request.formData();
		const details = v.parse(ReturnDetailsSchema, formValues(form, ['conditionIn', 'toLocationId']));
		try {
			await returnAsset(runtime().db, actorOf(event), event.params.id, details);
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: 'assignments.returned' };
	},

	delete: async (event) => {
		const actor = actorOf(event);
		try {
			await deleteAsset(runtime().db, actor, event.params.id);
		} catch (err) {
			return domainFailure(err);
		}
		redirect(303, `/t/${actor.tenant.slug}/assets`);
	}
};
