<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';

	let {
		values = {},
		errors = {}
	}: { values?: Record<string, string | null>; errors?: Record<string, string> } = $props();
	const t = useT();
</script>

<div class="field">
	<label for="displayName">{t('members.field.display_name')}</label>
	<input
		id="displayName"
		name="displayName"
		required
		maxlength="200"
		value={values.displayName ?? ''}
		aria-invalid={!!errors.displayName}
	/>
	{#if errors.displayName}<span class="hint">{t(errors.displayName)}</span>{/if}
</div>
<p class="muted">{t('members.optional_fields_hint')}</p>
<div class="field">
	<label for="email">{t('members.field.email')}</label>
	<input
		id="email"
		name="email"
		type="email"
		maxlength="254"
		value={values.email ?? ''}
		aria-invalid={!!errors.email}
		aria-describedby="email-hint"
	/>
	<span class="hint" id="email-hint"
		>{errors.email ? t(errors.email) : t('members.email_hint')}</span
	>
</div>
<div class="field">
	<label for="phone">{t('members.field.phone')}</label>
	<input id="phone" name="phone" type="tel" maxlength="50" value={values.phone ?? ''} />
</div>
<div class="field">
	<label for="memberNumber">{t('members.field.member_number')}</label>
	<input id="memberNumber" name="memberNumber" maxlength="50" value={values.memberNumber ?? ''} />
</div>
<div class="field">
	<label for="notes">{t('members.field.notes')}</label>
	<textarea id="notes" name="notes" rows="3" maxlength="2000" aria-describedby="notes-hint"
		>{values.notes ?? ''}</textarea
	>
	<span class="hint" id="notes-hint">{t('members.notes_hint')}</span>
</div>
