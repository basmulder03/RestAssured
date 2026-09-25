// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	contrastText,
	DEFAULT_THEME,
	themeCss,
	themeProblems,
	type Theme
} from '$lib/domain/theme';

describe('contrast', () => {
	it('matches known WCAG values', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
		// The classic "grey that just passes": #767676 on white is 4.54:1.
		expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
	});

	it('picks readable text for any background', () => {
		expect(contrastText('#1f4e79')).toBe('#ffffff');
		expect(contrastText('#ffd700')).toBe('#000000');
		for (const bg of ['#777777', '#808080', '#ff0000', '#00ff00', '#0000ff', '#c9a227']) {
			expect(contrastRatio(bg, contrastText(bg))).toBeGreaterThanOrEqual(4.5);
		}
	});
});

describe('themeProblems', () => {
	const theme = (overrides: Partial<Theme>): Theme => ({ ...DEFAULT_THEME, ...overrides });

	it('accepts the default theme', () => {
		expect(themeProblems(DEFAULT_THEME)).toEqual([]);
	});

	it('rejects anything that is not a typed value', () => {
		expect(themeProblems(theme({ primary: 'red' }))[0]?.code).toBe('theme.errors.color_invalid');
		expect(themeProblems(theme({ primary: '#fff;}body{display:none' }))[0]?.field).toBe('primary');
		expect(themeProblems(theme({ radius: 'huge' as Theme['radius'] }))[0]?.field).toBe('radius');
	});

	it('requires readable links: a light primary needs a darker accent', () => {
		const yellow = theme({ primary: '#ffd700' });
		expect(themeProblems(yellow)).toEqual([
			{ field: 'primary', code: 'theme.errors.link_contrast', params: { ratio: 1.4 } }
		]);
		expect(themeProblems({ ...yellow, accent: '#1a1a1a' })).toEqual([]);
		expect(themeProblems({ ...yellow, accent: '#ffe066' })[0]?.field).toBe('accent');
	});
});

describe('themeCss', () => {
	it('serialises only known properties with derived contrast colours', () => {
		expect(
			themeCss({ ...DEFAULT_THEME, primary: '#FFD700', accent: '#1A1A1A', radius: 'lg' })
		).toBe(
			":root{--ra-color-primary:#ffd700;--ra-color-primary-contrast:#000000;--ra-color-secondary:#c9a227;--ra-color-secondary-contrast:#000000;--ra-color-accent:#1a1a1a;--ra-radius:12px;--ra-font-family:system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;--ra-space-unit:8px}"
		);
	});
});
