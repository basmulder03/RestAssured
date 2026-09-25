<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import AssetFields from '$lib/components/AssetFields.svelte';
	import { useT } from '$lib/i18n/context';
	import { entityLabel } from '$lib/i18n/labels';

	let { data, form } = $props();
	const t = useT();
	const categories = $derived(
		data.categories
			.filter((c) => !c.archived)
			.map((c) => ({ id: c.id, label: entityLabel(t, data.locale, c) }))
	);
	const members = $derived(data.members.map((m) => ({ id: m.id, label: m.name })));
</script>

<svelte:head>
	<title>{t('assets.add')} · {data.tenant.name}</title>
</svelte:head>

<div class="stack page">
	<p>
		<a href={resolve('/t/[tenant]/assets', { tenant: data.tenant.slug })}>{t('assets.back')}</a>
	</p>
	<h1>{t('assets.add')}</h1>
	<form method="POST" class="stack">
		{#if form?.error}
			<p class="alert alert-error" role="alert">{t(form.error)}</p>
		{/if}
		<AssetFields
			values={form?.values ?? data.values}
			errors={form?.errors}
			{categories}
			{members}
			showFinancials={data.tenant.permissions.includes('assets:view_financials')}
		/>
		<button class="btn btn-primary" type="submit">{t('assets.add')}</button>
	</form>
</div>

<style>
	.page {
		max-width: 56rem;
	}
</style>
