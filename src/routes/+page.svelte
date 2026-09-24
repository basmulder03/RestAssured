<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';

	const t = useT();
</script>

<svelte:head>
	<title>{t('common.app_name')}</title>
</svelte:head>

<h1>{t('common.app_name')}</h1>
<p class="tagline">{t('common.tagline')}</p>

<style>
	h1 {
		margin-bottom: 0;
		color: var(--ra-color-primary);
	}

	.tagline {
		margin-top: calc(var(--ra-space-unit) / 2);
		color: var(--ra-text-muted);
		font-size: 1.125rem;
	}
</style>
