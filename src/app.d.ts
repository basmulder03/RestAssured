// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locale } from '$lib/i18n';
import type { SessionUser } from '$lib/server/auth/sessions';
import type { TenantContext } from '$lib/server/tenancy';

declare global {
	namespace App {
		interface Locals {
			locale: Locale;
			user: SessionUser | null;
			session: { secret: string; scopedTenantId: string | null } | null;
			/** Set for /t/[tenant]/… when the user is an active member; see requireTenant(). */
			tenant: TenantContext | null;
		}
		interface Error {
			/** An i18n key (ADR-0007). */
			message: string;
		}
	}
}

export {};
