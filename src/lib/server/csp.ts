// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';

/** CSP source for an inline <style> whose text content is exactly `css`. */
export function styleHash(css: string): string {
	return `'sha256-${createHash('sha256').update(css).digest('base64')}'`;
}

/**
 * Allows one specific inline stylesheet (the club theme, ADR-0002) by hash, without opening
 * style-src to inline styles in general. Leaves the policy alone when it already allows
 * 'unsafe-inline' (SvelteKit dev mode): adding a hash would make browsers ignore that.
 */
export function allowStyleHash(policy: string, hash: string): string {
	const directives = policy.split(';').map((d) => d.trim());
	const i = directives.findIndex((d) => d.startsWith('style-src ') || d === 'style-src');
	if (i < 0) return [...directives, `style-src 'self' ${hash}`].join('; ');
	if (directives[i]!.includes("'unsafe-inline'")) return policy;
	directives[i] = `${directives[i]} ${hash}`;
	return directives.join('; ');
}
