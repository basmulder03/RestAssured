<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Permission } from '$lib/domain/permissions';
	import { useT } from '$lib/i18n/context';

	let { data, children } = $props();
	const t = useT();
	const can = (p: Permission) => data.tenant.permissions.includes(p);
	const home = $derived(resolve('/t/[tenant]', { tenant: data.tenant.slug }));
	const members = $derived(resolve('/t/[tenant]/members', { tenant: data.tenant.slug }));
</script>

<nav class="club-nav" aria-label={t('club.nav_label')}>
	<a href={home} aria-current={page.url.pathname === home ? 'page' : undefined}
		>{t('club.overview')}</a
	>
	{#if can('members:view')}
		<a href={members} aria-current={page.url.pathname.startsWith(members) ? 'page' : undefined}>
			{t('members.title')}
		</a>
	{/if}
</nav>

{@render children()}

<style>
	.club-nav {
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--ra-space-unit) * 2);
		margin-bottom: calc(var(--ra-space-unit) * 3);
		border-bottom: 1px solid var(--ra-border);
	}

	.club-nav a {
		padding: var(--ra-space-unit) 0;
		color: var(--ra-text-muted);
		text-decoration: none;
	}

	.club-nav a[aria-current='page'] {
		color: var(--ra-text);
		font-weight: 600;
		border-bottom: 3px solid var(--ra-color-primary);
	}
</style>
