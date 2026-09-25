// SPDX-License-Identifier: AGPL-3.0-or-later
// Display helpers for assets. Enum values are never shown raw (ADR-0007).
import type { Translate } from './index';
import { memberName } from './labels';

export const ASSET_STATUS_KEYS: Record<string, string> = {
	active: 'assets.status.active',
	in_repair: 'assets.status.in_repair',
	retired: 'assets.status.retired',
	lost: 'assets.status.lost',
	sold: 'assets.status.sold'
};

/** "Yamaha YTR-2330", falling back to the tag, then a generic label. */
export function assetTitle(
	t: Translate,
	a: { brand: string | null; model: string | null; tag: string | null }
): string {
	return [a.brand, a.model].filter(Boolean).join(' ') || a.tag || t('assets.unnamed');
}

export function holderLabel(
	t: Translate,
	holder:
		| { kind: 'member'; name: string | null; pseudonymId: string | null }
		| { kind: 'location'; name: string }
		| null
): string {
	if (!holder) return t('assets.holder.unknown');
	if (holder.kind === 'location') return holder.name;
	return memberName(t, { displayName: holder.name, pseudonymId: holder.pseudonymId });
}
