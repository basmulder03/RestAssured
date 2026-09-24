// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, randomBytes } from 'node:crypto';

// 256-bit random secrets, base64url without padding → always 43 characters.
const SECRET_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** A new session id or link token. Only the hash is ever stored (ADR-0004). */
export function newSecret(): { secret: string; hash: Buffer } {
	const secret = randomBytes(32).toString('base64url');
	return { secret, hash: sha256(secret) };
}

/** Hash of a presented secret, or null when it can't be one of ours (skips the DB lookup). */
export function hashSecret(secret: string): Buffer | null {
	return SECRET_FORMAT.test(secret) ? sha256(secret) : null;
}

export function sha256Hex(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}
