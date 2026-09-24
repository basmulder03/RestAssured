<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { useT } from '$lib/i18n/context';
	import { formatDateTime } from '$lib/i18n/intl';

	let { data } = $props();
	const t = useT();
	const locale = $derived(data.locale);
	const STATUS_KEYS: Record<string, string> = {
		provisioning: 'platform.status.provisioning',
		active: 'platform.status.active',
		suspended: 'platform.status.suspended',
		pending_deletion: 'platform.status.pending_deletion'
	};
</script>

<svelte:head>
	<title>{t('platform.title')} · {t('common.app_name')}</title>
</svelte:head>

<div class="stack">
	<h1>{t('platform.title')}</h1>
	<p>
		<a class="btn btn-primary" href={resolve('/platform/tenants/new')}>{t('platform.new_club')}</a>
	</p>

	{#if data.tenants.length === 0}
		<p class="muted">{t('platform.no_clubs')}</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th scope="col">{t('platform.club_name')}</th>
					<th scope="col">{t('platform.club_slug')}</th>
					<th scope="col">{t('platform.club_status')}</th>
					<th scope="col">{t('platform.club_created')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.tenants as tenant (tenant.slug)}
					<tr>
						<td>{tenant.name}</td>
						<td><code>{tenant.slug}</code></td>
						<td>{t(STATUS_KEYS[tenant.status] ?? tenant.status)}</td>
						<td>{formatDateTime(locale, tenant.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
