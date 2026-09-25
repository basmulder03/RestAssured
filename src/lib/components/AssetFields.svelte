<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { ASSET_STATUS_KEYS } from '$lib/i18n/assets';
	import { useT } from '$lib/i18n/context';

	type Option = { id: string; label: string };
	let {
		values,
		errors = {},
		categories,
		members,
		showFinancials
	}: {
		values: Record<string, string>;
		errors?: Record<string, string>;
		categories: Option[];
		members: Option[];
		showFinancials: boolean;
	} = $props();
	const t = useT();
	const STATUSES = Object.keys(ASSET_STATUS_KEYS);
</script>

{#snippet error(field: string)}
	{#if errors[field]}<span class="hint error" id="{field}-error">{t(errors[field])}</span>{/if}
{/snippet}

<div class="grid">
	<div class="field">
		<label for="categoryId">{t('assets.field.category')}</label>
		<select id="categoryId" name="categoryId" required aria-invalid={!!errors.categoryId}>
			<option value="" disabled selected={!values.categoryId}>{t('assets.choose_category')}</option>
			{#each categories as c (c.id)}
				<option value={c.id} selected={values.categoryId === c.id}>{c.label}</option>
			{/each}
		</select>
		{@render error('categoryId')}
	</div>
	<div class="field">
		<label for="tag">{t('assets.field.tag')}</label>
		<input id="tag" name="tag" maxlength="50" value={values.tag} aria-invalid={!!errors.tag} />
		{@render error('tag')}
	</div>
	<div class="field">
		<label for="brand">{t('assets.field.brand')}</label>
		<input id="brand" name="brand" maxlength="100" value={values.brand} />
	</div>
	<div class="field">
		<label for="model">{t('assets.field.model')}</label>
		<input id="model" name="model" maxlength="100" value={values.model} />
	</div>
	<div class="field">
		<label for="serialNumber">{t('assets.field.serial_number')}</label>
		<input
			id="serialNumber"
			name="serialNumber"
			maxlength="100"
			value={values.serialNumber}
			aria-invalid={!!errors.serialNumber}
		/>
		{@render error('serialNumber')}
	</div>
	<div class="field">
		<label for="purchaseYear">{t('assets.field.purchase_year')}</label>
		<input
			id="purchaseYear"
			name="purchaseYear"
			inputmode="numeric"
			maxlength="4"
			value={values.purchaseYear}
			aria-invalid={!!errors.purchaseYear}
		/>
		{@render error('purchaseYear')}
	</div>
	{#if showFinancials}
		<div class="field">
			<label for="purchasePrice">{t('assets.field.purchase_price')}</label>
			<input
				id="purchasePrice"
				name="purchasePrice"
				inputmode="decimal"
				value={values.purchasePrice}
				aria-invalid={!!errors.purchasePrice}
			/>
			{@render error('purchasePrice')}
		</div>
		<div class="field">
			<label for="insuredValue">{t('assets.field.insured_value')}</label>
			<input
				id="insuredValue"
				name="insuredValue"
				inputmode="decimal"
				value={values.insuredValue}
				aria-invalid={!!errors.insuredValue}
			/>
			{@render error('insuredValue')}
		</div>
		<div class="field">
			<label for="insuredValueYear">{t('assets.field.insured_value_year')}</label>
			<input
				id="insuredValueYear"
				name="insuredValueYear"
				inputmode="numeric"
				maxlength="4"
				value={values.insuredValueYear}
				aria-invalid={!!errors.insuredValueYear}
			/>
			{@render error('insuredValueYear')}
		</div>
	{/if}
	<div class="field">
		<label for="status">{t('assets.field.status')}</label>
		<select id="status" name="status">
			{#each STATUSES as s (s)}
				<option value={s} selected={values.status === s}>{t(ASSET_STATUS_KEYS[s] ?? s)}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="ownership">{t('assets.field.ownership')}</label>
		<select id="ownership" name="ownership">
			<option value="club" selected={values.ownership !== 'private'}
				>{t('assets.ownership.club')}</option
			>
			<option value="private" selected={values.ownership === 'private'}
				>{t('assets.ownership.private')}</option
			>
		</select>
	</div>
	<div class="field">
		<label for="ownerMembershipId">{t('assets.field.owner')}</label>
		<select
			id="ownerMembershipId"
			name="ownerMembershipId"
			aria-invalid={!!errors.ownerMembershipId}
		>
			<option value="">—</option>
			{#each members as m (m.id)}
				<option value={m.id} selected={values.ownerMembershipId === m.id}>{m.label}</option>
			{/each}
		</select>
		<span class="hint"
			>{errors.ownerMembershipId ? t(errors.ownerMembershipId) : t('assets.owner_hint')}</span
		>
	</div>
</div>
<div class="field">
	<label for="description">{t('assets.field.description')}</label>
	<textarea id="description" name="description" rows="3" maxlength="2000"
		>{values.description}</textarea
	>
	<span class="hint">{t('assets.description_hint')}</span>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: calc(var(--ra-space-unit) * 2);
	}

	.error {
		color: #b3261e;
	}
</style>
