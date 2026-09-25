<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { ASSET_STATUS_KEYS, assetTitle, holderLabel } from '$lib/i18n/assets';
	import { useT } from '$lib/i18n/context';
	import { entityLabel } from '$lib/i18n/labels';

	let { data } = $props();
	const t = useT();
	const categoryName = $derived(
		new Map(data.categories.map((c) => [c.id, entityLabel(t, data.locale, c)]))
	);
	const canCreate = $derived(data.tenant.permissions.includes('assets:create'));
</script>

<svelte:head>
	<title>{t('assets.title')} · {data.tenant.name}</title>
</svelte:head>

<div class="stack">
	<div class="heading">
		<h1>{t('assets.title')}</h1>
		{#if canCreate}
			<a
				class="btn btn-primary"
				href={resolve('/t/[tenant]/assets/new', { tenant: data.tenant.slug })}>{t('assets.add')}</a
			>
		{/if}
	</div>

	<form method="GET" class="filters" role="search">
		<div class="field">
			<label for="q">{t('assets.search')}</label>
			<input id="q" name="q" type="search" value={data.filters.q} />
		</div>
		<div class="field">
			<label for="category">{t('assets.field.category')}</label>
			<select id="category" name="category">
				<option value="">{t('assets.all_categories')}</option>
				{#each data.categories as c (c.id)}
					<option value={c.id} selected={data.filters.categoryId === c.id}
						>{categoryName.get(c.id)}</option
					>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="status">{t('assets.field.status')}</label>
			<select id="status" name="status">
				<option value="current" selected={data.filters.status === 'current'}
					>{t('assets.status_current')}</option
				>
				<option value="all" selected={data.filters.status === 'all'}
					>{t('assets.status_all')}</option
				>
				{#each Object.entries(ASSET_STATUS_KEYS) as [value, key] (value)}
					<option {value} selected={data.filters.status === value}>{t(key)}</option>
				{/each}
			</select>
		</div>
		<button class="btn" type="submit">{t('assets.filter')}</button>
	</form>

	<p class="muted" role="status">{t('assets.count', { count: data.assets.length })}</p>

	{#if data.assets.length > 0}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">{t('assets.field.tag')}</th>
						<th scope="col">{t('assets.asset')}</th>
						<th scope="col">{t('assets.field.category')}</th>
						<th scope="col">{t('assets.field.serial_number')}</th>
						<th scope="col">{t('assets.where')}</th>
						<th scope="col">{t('assets.field.status')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.assets as a (a.id)}
						<tr>
							<td>{a.tag ?? ''}</td>
							<td>
								<a href={resolve('/t/[tenant]/assets/[id]', { tenant: data.tenant.slug, id: a.id })}
									>{assetTitle(t, a)}</a
								>
								{#if a.ownership === 'private'}<span class="muted">
										· {t('assets.ownership.private')}</span
									>{/if}
							</td>
							<td>{categoryName.get(a.categoryId)}</td>
							<td>{a.serialNumber ?? ''}</td>
							<td>{holderLabel(t, a.holder)}</td>
							<td>{t(ASSET_STATUS_KEYS[a.status] ?? a.status)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--ra-space-unit);
	}

	.heading h1 {
		margin: 0;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: calc(var(--ra-space-unit) * 2);
	}

	.table-scroll {
		overflow-x: auto;
	}
</style>
