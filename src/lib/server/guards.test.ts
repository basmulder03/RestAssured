// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './guards';

describe('safeRedirectPath', () => {
	it('keeps same-site relative paths', () => {
		expect(safeRedirectPath('/t/harmonie/assets?x=1')).toBe('/t/harmonie/assets?x=1');
	});

	it('rejects anything that could leave the site', () => {
		for (const next of [
			'//evil.example',
			'/\\evil.example',
			'https://evil.example',
			'evil',
			'',
			null
		]) {
			expect(safeRedirectPath(next)).toBe('/');
		}
	});
});
