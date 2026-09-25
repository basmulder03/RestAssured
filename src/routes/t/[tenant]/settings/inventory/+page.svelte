<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';
	import { entityLabel } from '$lib/i18n/labels';

	let { data, form } = $props();
	const t = useT();
	const KIND_KEYS: Record<string, string> = {
		instrument: 'categories.kind.instrument',
		clothing: 'categories.kind.clothing',
		accessory: 'categories.kind.accessory',
		case: 'categories.kind.case'
	};
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const values = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
	const feedbackFor = (formId: string) => (form?.formId === formId ? form : null);
	/** Names to pre-fill: the club's own, or the translation of a default category. */
	const namesOf = (c: (typeof data.categories)[number]) => ({
		nl: c.labelI18n?.nl ?? (c.labelKey && data.locale === 'nl' ? t(c.labelKey) : ''),
		en: c.labelI18n?.en ?? (c.labelKey && data.locale === 'en' ? t(c.labelKey) : '')
	});
</script>

<svelte:head>
	<title>{t('inventory_settings.title')} · {data.tenant.name}</title>
</svelte:head>

{#snippet feedback(formId: string)}
	{@const f = feedbackFor(formId)}
	{#if f && 'error' in f && f.error}
		<p class="alert alert-error" role="alert">
			{t(f.error, ('errorParams' in f ? f.errorParams : {}) ?? {})}
		</p>
	{:else if f && 'saved' in f && f.saved}
		<p class="alert alert-success" role="status">{t('inventory_settings.saved')}</p>
	{/if}
{/snippet}

{#snippet kindSelect(id: string, selected: string)}
	<select {id} name="kind">
		{#each Object.entries(KIND_KEYS) as [kind, key] (kind)}
			<option value={kind} selected={selected === kind}>{t(key)}</option>
		{/each}
	</select>
{/snippet}

<div class="stack page">
	<h1>{t('inventory_settings.title')}</h1>

	<section class="stack">
		<h2>{t('inventory_settings.categories')}</h2>
		<p class="muted">{t('inventory_settings.categories_intro')}</p>
		<ul class="rows">
			{#each data.categories as c (c.id)}
				{@const names = namesOf(c)}
				<li class:archived={c.archived}>
					<details>
						<summary>
							{entityLabel(t, data.locale, c)}
							<span class="muted">· {t(KIND_KEYS[c.kind] ?? c.kind)}</span>
							{#if c.archived}<span class="muted">· {t('inventory_settings.archived')}</span>{/if}
						</summary>
						{@render feedback(c.id)}
						<form method="POST" action="?/renameCategory" class="inline">
							<input type="hidden" name="id" value={c.id} />
							<div class="field">
								<label for="nl-{c.id}">{t('inventory_settings.name_nl')}</label>
								<input id="nl-{c.id}" name="nameNl" maxlength="100" value={names.nl} />
							</div>
							<div class="field">
								<label for="en-{c.id}">{t('inventory_settings.name_en')}</label>
								<input id="en-{c.id}" name="nameEn" maxlength="100" value={names.en} />
							</div>
							<div class="field">
								<label for="kind-{c.id}">{t('inventory_settings.kind')}</label>
								{@render kindSelect(`kind-${c.id}`, c.kind)}
							</div>
							<button class="btn" type="submit">{t('common.save')}</button>
						</form>
						<form method="POST" action="?/archiveCategory">
							<input type="hidden" name="id" value={c.id} />
							<input type="hidden" name="archived" value={String(!c.archived)} />
							<button class="btn-link" type="submit"
								>{c.archived
									? t('inventory_settings.restore')
									: t('inventory_settings.archive')}</button
							>
						</form>
					</details>
				</li>
			{/each}
		</ul>

		<form method="POST" action="?/createCategory" class="inline">
			<h3>{t('inventory_settings.new_category')}</h3>
			{@render feedback('newCategory')}
			<div class="field">
				<label for="new-nl">{t('inventory_settings.name_nl')}</label>
				<input
					id="new-nl"
					name="nameNl"
					maxlength="100"
					value={values.nameNl ?? ''}
					aria-invalid={!!errors.nameNl}
				/>
				{#if errors.nameNl}<span class="hint">{t(errors.nameNl)}</span>{/if}
			</div>
			<div class="field">
				<label for="new-en">{t('inventory_settings.name_en')}</label>
				<input id="new-en" name="nameEn" maxlength="100" value={values.nameEn ?? ''} />
			</div>
			<div class="field">
				<label for="new-kind">{t('inventory_settings.kind')}</label>
				{@render kindSelect('new-kind', values.kind ?? 'instrument')}
			</div>
			<button class="btn btn-primary" type="submit">{t('inventory_settings.add')}</button>
		</form>
	</section>

	<section class="stack">
		<h2>{t('inventory_settings.locations')}</h2>
		<p class="muted">{t('inventory_settings.locations_intro')}</p>
		<ul class="rows">
			{#each data.locations as l (l.id)}
				<li class:archived={l.archived}>
					{@render feedback(l.id)}
					<form method="POST" action="?/renameLocation" class="inline">
						<input type="hidden" name="id" value={l.id} />
						<div class="field">
							<label class="visually-hidden" for="loc-{l.id}"
								>{t('inventory_settings.location_name')}</label
							>
							<input id="loc-{l.id}" name="name" maxlength="200" value={l.name} />
						</div>
						<button class="btn" type="submit">{t('common.save')}</button>
					</form>
					<form method="POST" action="?/archiveLocation">
						<input type="hidden" name="id" value={l.id} />
						<input type="hidden" name="archived" value={String(!l.archived)} />
						<button class="btn-link" type="submit"
							>{l.archived
								? t('inventory_settings.restore')
								: t('inventory_settings.archive')}</button
						>
					</form>
				</li>
			{/each}
		</ul>

		<form method="POST" action="?/createLocation" class="inline">
			<h3>{t('inventory_settings.new_location')}</h3>
			{@render feedback('newLocation')}
			<div class="field">
				<label for="new-location">{t('inventory_settings.location_name')}</label>
				<input
					id="new-location"
					name="name"
					maxlength="200"
					value={values.name ?? ''}
					aria-invalid={!!errors.name}
				/>
				{#if errors.name}<span class="hint">{t(errors.name)}</span>{/if}
			</div>
			<button class="btn btn-primary" type="submit">{t('inventory_settings.add')}</button>
		</form>
	</section>
</div>

<style>
	.page {
		max-width: 56rem;
	}

	.page h2 {
		margin-bottom: 0;
	}

	.page h3 {
		width: 100%;
		margin: 0;
		font-size: 1.05rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--ra-space-unit);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rows li {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--ra-space-unit);
		padding: var(--ra-space-unit) 0;
		border-bottom: 1px solid var(--ra-border);
	}

	.rows li.archived {
		opacity: 0.7;
	}

	.rows details {
		width: 100%;
	}

	.rows summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: calc(var(--ra-space-unit) / 2);
	}

	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: calc(var(--ra-space-unit) * 2);
		margin: var(--ra-space-unit) 0;
	}
</style>
