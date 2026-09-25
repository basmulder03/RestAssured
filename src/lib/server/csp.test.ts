// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { allowStyleHash, styleHash } from '$lib/server/csp';

describe('allowStyleHash', () => {
	const hash = styleHash(':root{--x:1}');

	it('computes a CSP sha256 source', () => {
		expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
	});

	it('adds the hash to style-src only', () => {
		const policy =
			"default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self'; frame-ancestors 'none'";
		expect(allowStyleHash(policy, hash)).toBe(
			`default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self' ${hash}; frame-ancestors 'none'`
		);
	});

	it("leaves dev policies with 'unsafe-inline' untouched", () => {
		const dev = "style-src 'self' 'unsafe-inline'";
		expect(allowStyleHash(dev, hash)).toBe(dev);
	});
});
