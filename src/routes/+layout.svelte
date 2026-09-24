<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import { setI18n, useT } from '$lib/i18n/context';

	let { data, children } = $props();
	setI18n(() => data.locale);
	const t = useT();
	const otherClubs = $derived(data.clubs.filter((c) => c.slug !== data.currentClub?.slug));
</script>

<div class="page">
	{#if data.user}
		<header>
			<a class="brand" href={resolve('/')}>{data.currentClub?.name ?? t('common.app_name')}</a>
			<nav aria-label={t('nav.label')}>
				{#if otherClubs.length > 0}
					<!-- ADR-0001: switching clubs is navigation; works without JavaScript. -->
					<details class="switcher">
						<summary>{t('nav.switch_club')}</summary>
						<ul>
							{#each otherClubs as club (club.slug)}
								<li><a href={resolve('/t/[tenant]', { tenant: club.slug })}>{club.name}</a></li>
							{/each}
						</ul>
					</details>
				{/if}
				{#if data.user.isPlatformAdmin}
					<a href={resolve('/platform')}>{t('nav.platform')}</a>
				{/if}
				<a href={resolve('/account')}>{t('nav.account')}</a>
				<form method="POST" action="/logout">
					<button class="btn-link" type="submit">{t('nav.sign_out')}</button>
				</form>
			</nav>
		</header>
	{/if}

	<main>
		{@render children()}
	</main>

	<!-- AGPL §13: users of a network service must be offered its source (ADR-0009). -->
	<footer>
		<a href={data.sourceUrl} rel="noopener">{t('common.footer.source_code')}</a>
		<span aria-hidden="true">·</span>
		<span>{t('common.footer.license')}</span>
	</footer>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--ra-space-unit);
		padding: var(--ra-space-unit) calc(var(--ra-space-unit) * 2);
		background: var(--ra-color-primary);
		color: var(--ra-color-primary-contrast);
	}

	header a,
	header :global(.btn-link) {
		color: inherit;
	}

	.brand {
		font-weight: 700;
		font-size: 1.125rem;
		text-decoration: none;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--ra-space-unit) * 2);
	}

	nav form {
		margin: 0;
	}

	.switcher {
		position: relative;
	}

	.switcher summary {
		cursor: pointer;
	}

	.switcher ul {
		position: absolute;
		z-index: 10;
		right: 0;
		min-width: 14rem;
		margin: var(--ra-space-unit) 0 0;
		padding: var(--ra-space-unit) 0;
		list-style: none;
		border: 1px solid var(--ra-border);
		border-radius: var(--ra-radius);
		background: var(--ra-surface);
	}

	.switcher li a {
		display: block;
		padding: var(--ra-space-unit) calc(var(--ra-space-unit) * 2);
		color: var(--ra-text);
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 72rem;
		margin: 0 auto;
		padding: calc(var(--ra-space-unit) * 3) calc(var(--ra-space-unit) * 2);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--ra-space-unit);
		justify-content: center;
		padding: calc(var(--ra-space-unit) * 2);
		border-top: 1px solid var(--ra-border);
		color: var(--ra-text-muted);
		font-size: 0.875rem;
	}
</style>
