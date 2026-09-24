// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, type RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { domainFailure, fieldErrors, formValues, loadFailure } from '$lib/server/forms';
import { requireTenant, requireUser } from '$lib/server/guards';
import {
	getMember,
	inviteMember,
	issueAccountLink,
	listRoles,
	MemberSchema,
	setMemberRoles,
	setMemberStatus,
	updateMember,
	type IssuedLink
} from '$lib/server/members';
import { qrSvg } from '$lib/server/qr';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['displayName', 'email', 'phone', 'memberNumber', 'notes'] as const;

// Permissions are enforced in $lib/server/members; the actor carries the verified club context.
function actorOf({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(locals, url);
	return { userId: user.id, tenant: requireTenant(locals) };
}

async function shareable(link: IssuedLink, origin: string) {
	const url = new URL(`/auth/link/${link.secret}`, origin).href;
	return {
		purpose: link.purpose,
		url,
		expiresAt: link.expiresAt.toISOString(),
		qrSvg: await qrSvg(url)
	};
}

export const load: PageServerLoad = async (event) => {
	const actor = actorOf(event);
	try {
		const [member, roles] = await Promise.all([
			getMember(runtime().db, actor, event.params.id),
			listRoles(runtime().db, actor)
		]);
		return { member, roles, created: event.url.searchParams.has('created') };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	update: async (event) => {
		const values = formValues(await event.request.formData(), FIELDS);
		const parsed = v.safeParse(MemberSchema, values);
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.issues) });
		try {
			await updateMember(runtime().db, actorOf(event), event.params.id, parsed.output);
		} catch (err) {
			return domainFailure(err, { values });
		}
		return { saved: 'members.saved' };
	},

	deactivate: async (event) => {
		try {
			await setMemberStatus(runtime().db, actorOf(event), event.params.id, 'inactive');
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: 'members.deactivated' };
	},

	activate: async (event) => {
		try {
			await setMemberStatus(runtime().db, actorOf(event), event.params.id, 'active');
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: 'members.activated' };
	},

	invite: async (event) => {
		try {
			const link = await inviteMember(runtime().db, actorOf(event), event.params.id);
			return { link: await shareable(link, event.url.origin) };
		} catch (err) {
			return domainFailure(err);
		}
	},

	loginLink: async (event) => {
		try {
			const link = await issueAccountLink(
				runtime().db,
				actorOf(event),
				event.params.id,
				'magic_login'
			);
			return { link: await shareable(link, event.url.origin) };
		} catch (err) {
			return domainFailure(err);
		}
	},

	resetLink: async (event) => {
		try {
			const link = await issueAccountLink(
				runtime().db,
				actorOf(event),
				event.params.id,
				'password_reset'
			);
			return { link: await shareable(link, event.url.origin) };
		} catch (err) {
			return domainFailure(err);
		}
	},

	roles: async (event) => {
		const roleIds = (await event.request.formData()).getAll('role').map(String);
		try {
			await setMemberRoles(runtime().db, actorOf(event), event.params.id, roleIds);
		} catch (err) {
			return domainFailure(err);
		}
		return { saved: 'members.roles_saved' };
	}
};
