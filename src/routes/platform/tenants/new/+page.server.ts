// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { DomainError } from '$lib/server/errors';
import { requirePlatformAdmin } from '$lib/server/guards';
import { provisionTenant, ProvisionTenantSchema } from '$lib/server/platform';
import { qrSvg } from '$lib/server/qr';
import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requirePlatformAdmin(locals);
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const admin = requirePlatformAdmin(locals);
		const values = Object.fromEntries(
			['slug', 'name', 'defaultLocale', 'adminName', 'adminEmail'].map((k) => [k, ''])
		) as Record<string, string>;
		const form = await request.formData();
		for (const key of Object.keys(values)) values[key] = String(form.get(key) ?? '');

		const parsed = v.safeParse(ProvisionTenantSchema, values);
		if (!parsed.success) {
			const errors = Object.fromEntries(
				parsed.issues.map((i) => [v.getDotPath(i) ?? 'form', i.message])
			);
			return fail(400, { values, errors });
		}
		try {
			const { invite } = await provisionTenant(runtime().db, parsed.output, admin.id);
			const link = new URL(`/auth/link/${invite.secret}`, url.origin).href;
			return {
				created: {
					name: parsed.output.name,
					slug: parsed.output.slug,
					adminName: parsed.output.adminName,
					link,
					expiresAt: invite.expiresAt.toISOString(),
					qrSvg: await qrSvg(link)
				}
			};
		} catch (err) {
			if (err instanceof DomainError) return fail(400, { values, errors: { form: err.code } });
			throw err;
		}
	}
};
