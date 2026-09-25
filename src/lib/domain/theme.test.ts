// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	contrastText,
	DARK_SURFACE,
	displayRatio,
	LIGHT_SURFACE,
	linkColors,
	readableOn,
	SURFACES,
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
			":root{--ra-color-primary:#ffd700;--ra-color-primary-contrast:#000000;--ra-color-secondary:#c9a227;--ra-color-secondary-contrast:#000000;--ra-color-accent:#1a1a1a;--ra-link-light:#1a1a1a;--ra-link-dark:#818181;--ra-radius:12px;--ra-font-family:system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;--ra-space-unit:8px}"
		);
	});
});

describe('link colours per surface', () => {
	it('keeps a readable colour and adjusts an unreadable one on dark pages', () => {
		for (const color of ['#000000', '#ff0000', '#8b0000', '#1f4e79', '#ffd700', '#ffffff']) {
			const { dark } = linkColors({ ...DEFAULT_THEME, primary: color, accent: null });
			expect(contrastRatio(dark, DARK_SURFACE), color).toBeGreaterThanOrEqual(4.5);
		}
		// Already readable on dark: left as chosen.
		expect(readableOn('#ffd700', DARK_SURFACE)).toBe('#ffd700');
		// Black on white is 21:1; pure red on white is just under 4.5:1 per WCAG.
		expect(displayRatio(contrastRatio('#000000', LIGHT_SURFACE))).toBe(21);
		expect(displayRatio(contrastRatio('#ff0000', LIGHT_SURFACE))).toBe(3.99);
	});

	it('matches the defaults in app.css and the surfaces there', () => {
		const css = readFileSync('src/app.css', 'utf8');
		const { light, dark } = linkColors(DEFAULT_THEME);
		expect(css).toContain(`--ra-link-light: ${light};`);
		expect(css).toContain(`--ra-link-dark: ${dark};`);
		for (const mode of Object.values(SURFACES)) {
			for (const [name, value] of Object.entries(mode)) expect(css).toContain(`${name}: ${value};`);
		}
	});
});
