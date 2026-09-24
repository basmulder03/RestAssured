// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { domainFailure, fieldErrors, formValues } from '$lib/server/forms';
import { requirePermission, requireUser } from '$lib/server/guards';
import { createMember, listMembers, listRoles, MemberSchema } from '$lib/server/members';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['displayName', 'email', 'phone', 'memberNumber', 'notes'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const tenant = requirePermission(locals, 'members:view');
	const actor = { userId: user.id, tenant };
	const [members, roles] = await Promise.all([
		listMembers(runtime().db, actor),
		listRoles(runtime().db, actor)
	]);
	return { members, roles };
};

export const actions: Actions = {
	create: async ({ locals, request, url }) => {
		const user = requireUser(locals, url);
		const tenant = requirePermission(locals, 'members:manage');
		const values = formValues(await request.formData(), FIELDS);
		const parsed = v.safeParse(MemberSchema, values);
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.issues) });
		let id: string;
		try {
			id = await createMember(runtime().db, { userId: user.id, tenant }, parsed.output);
		} catch (err) {
			return domainFailure(err, { values });
		}
		redirect(303, `/t/${tenant.slug}/members/${id}?created`);
	}
};
