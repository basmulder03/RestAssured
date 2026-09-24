<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- ADR-0004 manual delivery: a one-time link shown once, to copy or scan and hand over. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { useT } from '$lib/i18n/context';
	import { formatDateTime } from '$lib/i18n/intl';

	let {
		url,
		expiresAt,
		qrSvg,
		locale
	}: { url: string; expiresAt: string; qrSvg: string; locale: string } = $props();
	const t = useT();

	let canCopy = $state(false);
	let copied = $state(false);
	onMount(() => (canCopy = typeof navigator.clipboard?.writeText === 'function'));

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
	}
</script>

<div class="link-share stack">
	<div class="field">
		<label for="share-link">{t('links.share.label')}</label>
		<input
			id="share-link"
			type="text"
			readonly
			value={url}
			onfocus={(e) => e.currentTarget.select()}
		/>
	</div>
	{#if canCopy}
		<button class="btn" type="button" onclick={copy}>
			{copied ? t('links.share.copied') : t('links.share.copy')}
		</button>
	{/if}
	<!-- Generated server-side by the qrcode library from our own URL; contains no user input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="qr" role="img" aria-label={t('links.share.qr_label')}>{@html qrSvg}</div>
	<p class="muted">{t('links.share.expires', { date: formatDateTime(locale, expiresAt) })}</p>
	<p class="alert">{t('links.share.warning')}</p>
</div>

<style>
	.qr {
		width: 12rem;
		padding: var(--ra-space-unit);
		background: #ffffff;
		border-radius: var(--ra-radius);
	}

	.qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
