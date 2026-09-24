// SPDX-License-Identifier: AGPL-3.0-or-later
import { hash, verify } from '@node-rs/argon2';

// ADR-0004: Argon2id at (at least) the OWASP minimum: 19 MiB, 2 iterations, 1 lane.
const PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/** i18n error code for an unacceptable password, or null. No composition rules (NIST 800-63B). */
export function passwordProblem(password: string, email: string | null): string | null {
	if (password.length < PASSWORD_MIN_LENGTH) return 'errors.password.too_short';
	if (password.length > PASSWORD_MAX_LENGTH) return 'errors.password.too_long';
	const local = email?.split('@')[0]?.toLowerCase();
	if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
		return 'errors.password.contains_email';
	}
	return null;
}

export function hashPassword(password: string): Promise<string> {
	return hash(password, PARAMS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies a password. With no stored hash it still does a full Argon2 verification against a
 * dummy, so response time doesn't reveal whether an account (or password) exists.
 */
export async function verifyPassword(
	storedHash: string | null,
	password: string
): Promise<boolean> {
	if (!storedHash) {
		dummyHash ??= hash('restassured-timing-equaliser', PARAMS);
		await verify(await dummyHash, password).catch(() => false);
		return false;
	}
	return verify(storedHash, password).catch(() => false);
}
