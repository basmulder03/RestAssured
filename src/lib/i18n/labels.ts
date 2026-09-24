// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Translate } from './index';

/**
 * ADR-0007 §5: system entities carry a `label_key`; renamed or club-defined ones carry
 * `label_i18n`. Requested locale → nl → any available value → the key.
 */
export function entityLabel(
	t: Translate,
	locale: string,
	entity: { labelKey: string | null; labelI18n: Record<string, string> | null }
): string {
	const own = entity.labelI18n;
	if (own) return own[locale] ?? own.nl ?? Object.values(own)[0] ?? '';
	return entity.labelKey ? t(entity.labelKey) : '';
}

/** Anonymized members are rendered from a key, never stored as text (ADR-0005). */
export function memberName(
	t: Translate,
	member: { displayName: string | null; pseudonymId: string | null }
): string {
	return member.displayName ?? t('members.anonymized_label', { id: member.pseudonymId ?? '' });
}
