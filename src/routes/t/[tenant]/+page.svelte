<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { useT } from '$lib/i18n/context';

	let { data } = $props();
	const t = useT();
	const assets = $derived(resolve('/t/[tenant]/assets', { tenant: data.tenant.slug }));
</script>

<svelte:head>
	<title>{data.tenant.name} · {t('common.app_name')}</title>
</svelte:head>

<h1>{data.tenant.name}</h1>
{#if data.tenant.status === 'suspended'}
	<p class="alert">{t('club.suspended')}</p>
{/if}

{#if data.stats}
	<ul class="stats">
		<li><strong>{data.stats.current}</strong> {t('club.stats.current')}</li>
		<li><strong>{data.stats.onLoan}</strong> {t('club.stats.on_loan')}</li>
		<li><strong>{data.stats.inRepair}</strong> {t('club.stats.in_repair')}</li>
		<li><strong>{data.stats.unplaced}</strong> {t('club.stats.unplaced')}</li>
	</ul>
	<p><a class="btn" href={assets}>{t('club.to_assets')}</a></p>
{:else}
	<p class="muted">{t('club.no_asset_access')}</p>
{/if}

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: calc(var(--ra-space-unit) * 2);
		padding: 0;
		list-style: none;
	}

	.stats li {
		display: flex;
		flex-direction: column;
		padding: calc(var(--ra-space-unit) * 2);
		border: 1px solid var(--ra-border);
		border-radius: var(--ra-radius);
		color: var(--ra-text-muted);
	}

	.stats strong {
		color: var(--ra-text);
		font-size: 2rem;
		line-height: 1.2;
	}
</style>
