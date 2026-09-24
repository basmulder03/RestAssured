<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { useT } from '$lib/i18n/context';

	let { data } = $props();
	const t = useT();
</script>

<svelte:head>
	<title>{t('common.app_name')}</title>
</svelte:head>

{#if !data.signedIn}
	<section class="hero">
		<h1>{t('common.app_name')}</h1>
		<p class="tagline">{t('common.tagline')}</p>
		<p><a class="btn btn-primary" href={resolve('/login')}>{t('auth.sign_in')}</a></p>
	</section>
{:else}
	<section class="card stack">
		<h1>{t('home.choose_club')}</h1>
		{#if data.clubs.length === 0}
			<p class="muted">{t('home.no_clubs')}</p>
		{:else}
			<ul>
				{#each data.clubs as club (club.slug)}
					<li><a href={resolve('/t/[tenant]', { tenant: club.slug })}>{club.name}</a></li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.hero h1 {
		margin-bottom: 0;
		color: var(--ra-color-primary);
	}

	.tagline {
		margin-top: calc(var(--ra-space-unit) / 2);
		color: var(--ra-text-muted);
		font-size: 1.125rem;
	}
</style>
