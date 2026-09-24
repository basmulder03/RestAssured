<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import '../app.css';
	import { setI18n, useT } from '$lib/i18n/context';

	let { data, children } = $props();
	setI18n(() => data.locale);
	const t = useT();
</script>

<div class="page">
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
