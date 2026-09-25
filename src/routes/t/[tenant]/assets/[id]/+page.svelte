<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import AssetFields from '$lib/components/AssetFields.svelte';
	import type { Permission } from '$lib/domain/permissions';
	import { formatMoney } from '$lib/domain/money';
	import { ASSET_STATUS_KEYS, assetTitle, holderLabel } from '$lib/i18n/assets';
	import { useT } from '$lib/i18n/context';
	import { formatDateTime } from '$lib/i18n/intl';
	import { entityLabel, memberName } from '$lib/i18n/labels';

	let { data, form } = $props();
	const t = useT();
	const can = (p: Permission) => data.tenant.permissions.includes(p);
	const a = $derived(data.asset);
	const writable = $derived(data.tenant.status === 'active');
	const lendable = $derived(a.status === 'active' || a.status === 'in_repair');
	const lentOut = $derived(a.holder?.kind === 'member');
	const categoryLabel = $derived(
		entityLabel(
			t,
			data.locale,
			data.categories.find((c) => c.id === a.categoryId) ?? { labelKey: null, labelI18n: null }
		)
	);
	const categories = $derived(
		data.categories
			.filter((c) => !c.archived || c.id === a.categoryId)
			.map((c) => ({ id: c.id, label: entityLabel(t, data.locale, c) }))
	);
	const members = $derived(data.members.map((m) => ({ id: m.id, label: m.name })));
	const money = (cents: number | null | undefined) =>
		cents == null ? '—' : formatMoney(data.locale, cents, data.tenant.currency);
</script>

<svelte:head>
	<title>{assetTitle(t, a)} · {data.tenant.name}</title>
</svelte:head>

<div class="stack page">
	<p>
		<a href={resolve('/t/[tenant]/assets', { tenant: data.tenant.slug })}>{t('assets.back')}</a>
	</p>
	<div>
		<h1>{assetTitle(t, a)}</h1>
		<p class="muted">
			{categoryLabel}{#if a.tag}&nbsp;· {a.tag}{/if} · {t(ASSET_STATUS_KEYS[a.status] ?? a.status)}
		</p>
	</div>

	{#if data.created}
		<p class="alert alert-success" role="status">{t('assets.created')}</p>
	{/if}
	{#if form?.error}
		<p class="alert alert-error" role="alert">{t(form.error, form.errorParams ?? {})}</p>
	{:else if form?.saved}
		<p class="alert alert-success" role="status">{t(form.saved)}</p>
	{/if}

	<section class="card wide stack where">
		<h2>{t('assets.where')}</h2>
		<p class="holder">
			{holderLabel(t, a.holder)}
			{#if a.holder}
				<span class="muted"
					>· {t('assets.since', { date: formatDateTime(data.locale, a.holder.since) })}</span
				>
			{/if}
		</p>

		{#if can('assignments:manage') && writable}
			{#if lentOut}
				<form method="POST" action="?/return" class="stack">
					<h3>{t('assignments.return_title')}</h3>
					<div class="field">
						<label for="conditionIn">{t('assignments.condition_in')}</label>
						<input id="conditionIn" name="conditionIn" maxlength="500" />
					</div>
					<div class="field">
						<label for="toLocationId">{t('assignments.return_to')}</label>
						<select id="toLocationId" name="toLocationId">
							<option value="">{t('assignments.return_to_none')}</option>
							{#each data.locations as l (l.id)}
								<option value={l.id}>{l.name}</option>
							{/each}
						</select>
					</div>
					<button class="btn btn-primary" type="submit">{t('assignments.return')}</button>
				</form>
			{:else if lendable}
				<form method="POST" action="?/assign" class="stack">
					<h3>{t('assignments.assign_title')}</h3>
					<div class="field">
						<label for="target">{t('assignments.target')}</label>
						<select id="target" name="target" required>
							<option value="" selected disabled>{t('assignments.choose_target')}</option>
							{#if data.members.length}
								<optgroup label={t('assignments.to_member')}>
									{#each data.members as m (m.id)}
										<option value="member:{m.id}">{m.name}</option>
									{/each}
								</optgroup>
							{/if}
							{#if data.locations.length}
								<optgroup label={t('assignments.to_location')}>
									{#each data.locations as l (l.id)}
										<option value="location:{l.id}" disabled={a.holder?.id === l.id}
											>{l.name}</option
										>
									{/each}
								</optgroup>
							{/if}
						</select>
					</div>
					<div class="field">
						<label for="conditionOut">{t('assignments.condition_out')}</label>
						<input id="conditionOut" name="conditionOut" maxlength="500" />
					</div>
					<div class="field">
						<label for="notes">{t('assignments.notes')}</label>
						<input id="notes" name="notes" maxlength="2000" aria-describedby="notes-hint" />
						<span class="hint" id="notes-hint">{t('members.notes_hint')}</span>
					</div>
					<button class="btn btn-primary" type="submit">{t('assignments.assign')}</button>
				</form>
			{:else}
				<p class="muted">{t('assignments.not_lendable_hint')}</p>
			{/if}
		{/if}
	</section>

	<section class="stack">
		<h2>{t('assets.details')}</h2>
		{#if can('assets:edit') && writable}
			<form method="POST" action="?/update" class="stack">
				<AssetFields
					values={form?.values ?? data.values}
					errors={form?.errors}
					{categories}
					{members}
					showFinancials={a.financials !== null}
				/>
				<button class="btn btn-primary" type="submit">{t('common.save')}</button>
			</form>
		{:else}
			<dl>
				<dt>{t('assets.field.brand')}</dt>
				<dd>{a.brand ?? '—'}</dd>
				<dt>{t('assets.field.model')}</dt>
				<dd>{a.model ?? '—'}</dd>
				<dt>{t('assets.field.serial_number')}</dt>
				<dd>{a.serialNumber ?? '—'}</dd>
				<dt>{t('assets.field.purchase_year')}</dt>
				<dd>{a.purchaseYear ?? '—'}</dd>
				{#if a.financials}
					<dt>{t('assets.field.purchase_price')}</dt>
					<dd>{money(a.financials.purchasePriceCents)}</dd>
					<dt>{t('assets.field.insured_value')}</dt>
					<dd>
						{money(a.financials.insuredValueCents)}{#if a.financials.insuredValueYear}&nbsp;({a
								.financials.insuredValueYear}){/if}
					</dd>
				{/if}
				<dt>{t('assets.field.ownership')}</dt>
				<dd>
					{a.ownership === 'private'
						? `${t('assets.ownership.private')} · ${a.owner ? memberName(t, { displayName: a.owner.name, pseudonymId: a.owner.pseudonymId }) : ''}`
						: t('assets.ownership.club')}
				</dd>
				<dt>{t('assets.field.description')}</dt>
				<dd>{a.description ?? '—'}</dd>
			</dl>
		{/if}
	</section>

	{#if data.history}
		<section class="stack">
			<h2>{t('assets.history')}</h2>
			{#if data.history.length === 0}
				<p class="muted">{t('assets.history_empty')}</p>
			{:else}
				<ol class="history">
					{#each data.history as h (h.id)}
						<li>
							<strong>{holderLabel(t, h.holder)}</strong>
							<span class="muted">
								{formatDateTime(data.locale, h.checkedOutAt)} –
								{h.returnedAt ? formatDateTime(data.locale, h.returnedAt) : t('assets.history_now')}
							</span>
							{#if h.conditionOut}<div>{t('assignments.condition_out')}: {h.conditionOut}</div>{/if}
							{#if h.conditionIn}<div>{t('assignments.condition_in')}: {h.conditionIn}</div>{/if}
							{#if h.notes}<div>{t('assignments.notes')}: {h.notes}</div>{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}

	{#if can('assets:delete') && writable}
		<section class="stack">
			<h2>{t('assets.delete_title')}</h2>
			{#if a.hasHistory}
				<p class="muted">{t('assets.delete_has_history')}</p>
			{:else}
				<form method="POST" action="?/delete">
					<button class="btn" type="submit">{t('assets.delete')}</button>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 56rem;
	}

	.page h1 {
		margin-bottom: 0;
	}

	.page h2 {
		margin-bottom: 0;
		font-size: 1.25rem;
	}

	.page h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.where {
		margin: 0;
	}

	.holder {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.history {
		display: flex;
		flex-direction: column;
		gap: calc(var(--ra-space-unit) * 1.5);
		padding-left: calc(var(--ra-space-unit) * 2.5);
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--ra-space-unit) calc(var(--ra-space-unit) * 2);
	}

	dd {
		margin: 0;
	}
</style>
