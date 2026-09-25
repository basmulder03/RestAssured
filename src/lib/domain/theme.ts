// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0002: club themes are typed values, validated, then serialised to CSS custom properties.
// Tenant input never reaches CSS any other way.

export const RADII = { none: '0', sm: '3px', md: '6px', lg: '12px' } as const;
// System font stacks only: nothing is downloaded (ADR-0009).
export const FONTS = {
	system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
	serif: "Georgia, Cambria, 'Times New Roman', serif",
	rounded: "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
} as const;
export const DENSITIES = { compact: '6px', comfortable: '8px' } as const;

export type Radius = keyof typeof RADII;
export type Font = keyof typeof FONTS;
export type Density = keyof typeof DENSITIES;

export type Theme = {
	primary: string;
	secondary: string;
	/** Links and focus rings; null = same as primary. */
	accent: string | null;
	radius: Radius;
	font: Font;
	density: Density;
};

export const DEFAULT_THEME: Theme = {
	primary: '#1f4e79',
	secondary: '#c9a227',
	accent: null,
	radius: 'md',
	font: 'system',
	density: 'comfortable'
};

/** WCAG 2.2 AA for normal text. */
export const MIN_CONTRAST = 4.5;
/** The light surface links are drawn on (see app.css). */
export const LIGHT_SURFACE = '#ffffff';

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
	return typeof value === 'string' && HEX.test(value);
}

function channel(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	return (
		0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
	);
}

export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `background`. Always ≥ 4.58:1. */
export function contrastText(background: string): '#000000' | '#ffffff' {
	return contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff')
		? '#000000'
		: '#ffffff';
}

export type ThemeProblem = {
	field: keyof Theme;
	code: string;
	params?: Record<string, string | number>;
};

/**
 * Checks a theme. Text on the brand colours always gets black or white, so that can't fail;
 * what can fail is the link colour (accent, or primary) on the light page background.
 */
export function themeProblems(theme: Theme): ThemeProblem[] {
	const problems: ThemeProblem[] = [];
	for (const field of ['primary', 'secondary'] as const) {
		if (!isHexColor(theme[field])) problems.push({ field, code: 'theme.errors.color_invalid' });
	}
	if (theme.accent !== null && !isHexColor(theme.accent)) {
		problems.push({ field: 'accent', code: 'theme.errors.color_invalid' });
	}
	if (!(theme.radius in RADII)) problems.push({ field: 'radius', code: 'errors.invalid' });
	if (!(theme.font in FONTS)) problems.push({ field: 'font', code: 'errors.invalid' });
	if (!(theme.density in DENSITIES)) problems.push({ field: 'density', code: 'errors.invalid' });
	if (problems.length) return problems;

	const link = theme.accent ?? theme.primary;
	const ratio = contrastRatio(link, LIGHT_SURFACE);
	if (ratio < MIN_CONTRAST) {
		problems.push({
			field: theme.accent ? 'accent' : 'primary',
			code: 'theme.errors.link_contrast',
			params: { ratio: Math.floor(ratio * 100) / 100 }
		});
	}
	return problems;
}

/** Custom properties for a valid theme. Callers must have checked `themeProblems` first. */
export function themeVariables(theme: Theme): Record<string, string> {
	return {
		'--ra-color-primary': theme.primary.toLowerCase(),
		'--ra-color-primary-contrast': contrastText(theme.primary),
		'--ra-color-secondary': theme.secondary.toLowerCase(),
		'--ra-color-secondary-contrast': contrastText(theme.secondary),
		'--ra-color-accent': (theme.accent ?? theme.primary).toLowerCase(),
		'--ra-radius': RADII[theme.radius],
		'--ra-font-family': FONTS[theme.font],
		'--ra-space-unit': DENSITIES[theme.density]
	};
}

/** `:root{…}` for the inline <style> in <head>. Values come only from the typed tables above. */
export function themeCss(theme: Theme): string {
	const body = Object.entries(themeVariables(theme))
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
	return `:root{${body}}`;
}
