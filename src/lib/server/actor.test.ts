// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { isUuid } from '$lib/server/actor';
import { parseTarget } from '$lib/server/assets';

describe('id validation', () => {
	it('accepts only real UUIDs', () => {
		expect(isUuid('1afaf623-b221-4902-b046-e564875e6b31')).toBe(true);
		// Same length and alphabet as a UUID, but not one: must not reach the database.
		expect(isUuid('c-eb737eba-586d-4fba-8bec-284c5ada32')).toBe(false);
		expect(isUuid('')).toBe(false);
		expect(isUuid(undefined)).toBe(false);
	});

	it('parses lending targets strictly', () => {
		const id = '1afaf623-b221-4902-b046-e564875e6b31';
		expect(parseTarget(`member:${id}`)).toEqual({ kind: 'member', id });
		expect(parseTarget(`location:${id}`)).toEqual({ kind: 'location', id });
		expect(parseTarget('location:c-eb737eba-586d-4fba-8bec-284c5ada32')).toBeNull();
		expect(parseTarget(`user:${id}`)).toBeNull();
		expect(parseTarget(`member:${id}:x`)).toBeNull();
	});
});
