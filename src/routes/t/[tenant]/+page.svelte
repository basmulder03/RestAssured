<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';

	let { data } = $props();
	const t = useT();
</script>

<svelte:head>
	<title>{data.tenant.name} · {t('common.app_name')}</title>
</svelte:head>

<h1>{data.tenant.name}</h1>
{#if data.tenant.status === 'suspended'}
	<p class="alert">{t('club.suspended')}</p>
{/if}
<p class="muted">{t('club.dashboard_placeholder')}</p>
