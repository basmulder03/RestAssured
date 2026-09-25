// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, PERMISSION_GROUPS, permissionLabelKey } from '$lib/domain/permissions';

describe('permission catalogue', () => {
	it('uses resource:action codes whose resource is the group', () => {
		for (const p of PERMISSIONS) {
			expect(p.code).toMatch(/^[a-z_]+:[a-z_]+$/);
			expect(p.code.split(':')[0]).toBe(p.group);
		}
	});

	it('has unique codes and only known groups', () => {
		const codes = PERMISSIONS.map((p) => p.code);
		expect(new Set(codes).size).toBe(codes.length);
		for (const p of PERMISSIONS) expect(PERMISSION_GROUPS).toContain(p.group);
	});

	it('flags the ADR-0003 dangerous permissions', () => {
		const dangerous = PERMISSIONS.filter((p) => p.dangerous).map((p) => p.code);
		expect(dangerous.sort()).toEqual(
			['members:anonymize', 'members:reset_password', 'roles:manage'].sort()
		);
	});

	it('derives i18n keys', () => {
		expect(permissionLabelKey('assets:view_financials')).toBe('perm.assets.view_financials.label');
	});
});
