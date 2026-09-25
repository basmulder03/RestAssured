<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import {
		contrastRatio,
		LIGHT_SURFACE,
		MIN_CONTRAST,
		themeVariables,
		themeProblems,
		type Theme
	} from '$lib/domain/theme';
	import { untrack } from 'svelte';
	import { useT } from '$lib/i18n/context';

	let { data, form } = $props();
	const t = useT();

	// Editable copy of the saved theme; after a failed save the submitted values come back in
	// `form.theme`. Taken once on purpose, then re-taken only when the saved theme changes (reset).
	const initial = untrack(() => (form?.theme as Theme | undefined) ?? data.theme);
	let theme = $state<Theme>({ ...initial });
	let useAccent = $state(initial.accent !== null);
	let accentValue = $state(initial.accent ?? initial.primary);
	let loaded = untrack(() => data.theme);
	$effect(() => {
		const saved = data.theme;
		if (saved === loaded) return;
		loaded = saved;
		theme = { ...saved };
		useAccent = saved.accent !== null;
		accentValue = saved.accent ?? saved.primary;
	});

	const current = $derived<Theme>({ ...theme, accent: useAccent ? accentValue : null });
	const problems = $derived(themeProblems(current));
	const linkRatio = $derived(contrastRatio(current.accent ?? current.primary, LIGHT_SURFACE));
	const serverErrors = $derived(
		(form && 'errors' in form ? form.errors : {}) as Record<string, string>
	);

	const LABELS: Record<string, string> = {
		none: 'theme.radius.none',
		sm: 'theme.radius.sm',
		md: 'theme.radius.md',
		lg: 'theme.radius.lg',
		system: 'theme.font.system',
		serif: 'theme.font.serif',
		rounded: 'theme.font.rounded',
		compact: 'theme.density.compact',
		comfortable: 'theme.density.comfortable'
	};

	// Live preview via CSSOM (style.setProperty), which CSP allows; inline style attributes it doesn't.
	let preview = $state<HTMLElement>();
	$effect(() => {
		if (!preview || problems.some((p) => p.code !== 'theme.errors.link_contrast')) return;
		for (const [name, value] of Object.entries(themeVariables(current))) {
			preview.style.setProperty(name, value);
		}
		preview.style.setProperty('--ra-link', current.accent ?? current.primary);
	});
</script>

<svelte:head>
	<title>{t('theme.title')} · {data.tenant.name}</title>
</svelte:head>

<div class="stack page">
	<h1>{t('theme.title')}</h1>
	<p class="muted">{t('theme.intro')}</p>

	{#if form && 'saved' in form && form.saved}
		<p class="alert alert-success" role="status">
			{form.reset ? t('theme.reset_done') : t('theme.saved')}
		</p>
	{:else if form && 'error' in form && form.error}
		<p class="alert alert-error" role="alert">{t(form.error, form.errorParams ?? {})}</p>
	{/if}

	<div class="layout">
		<form method="POST" action="?/save" class="stack">
			<div class="colors">
				<div class="field">
					<label for="primary">{t('theme.primary')}</label>
					<input id="primary" name="primary" type="color" bind:value={theme.primary} />
				</div>
				<div class="field">
					<label for="secondary">{t('theme.secondary')}</label>
					<input id="secondary" name="secondary" type="color" bind:value={theme.secondary} />
				</div>
			</div>

			<label class="check">
				<input type="checkbox" name="useAccent" bind:checked={useAccent} />
				{t('theme.use_accent')}
			</label>
			<div class="field">
				<label for="accent">{t('theme.accent')}</label>
				<input
					id="accent"
					name="accent"
					type="color"
					bind:value={accentValue}
					disabled={!useAccent}
				/>
				<span class="hint">{t('theme.accent_hint')}</span>
			</div>

			<p
				class={linkRatio >= MIN_CONTRAST ? 'alert alert-success' : 'alert alert-error'}
				role="status"
			>
				{linkRatio >= MIN_CONTRAST
					? t('theme.contrast_ok', { ratio: Math.floor(linkRatio * 10) / 10 })
					: t('theme.errors.link_contrast', { ratio: Math.floor(linkRatio * 10) / 10 })}
			</p>
			{#if serverErrors.primary || serverErrors.secondary || serverErrors.accent}
				<p class="alert alert-error" role="alert">
					{t(serverErrors.accent ?? serverErrors.primary ?? serverErrors.secondary ?? '', {
						ratio: Math.floor(linkRatio * 10) / 10
					})}
				</p>
			{/if}

			<div class="field">
				<label for="radius">{t('theme.radius_label')}</label>
				<select id="radius" name="radius" bind:value={theme.radius}>
					{#each data.options.radii as r (r)}<option value={r}>{t(LABELS[r] ?? r)}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="font">{t('theme.font_label')}</label>
				<select id="font" name="font" bind:value={theme.font}>
					{#each data.options.fonts as f (f)}<option value={f}>{t(LABELS[f] ?? f)}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="density">{t('theme.density_label')}</label>
				<select id="density" name="density" bind:value={theme.density}>
					{#each data.options.densities as d (d)}<option value={d}>{t(LABELS[d] ?? d)}</option
						>{/each}
				</select>
			</div>

			<button class="btn btn-primary" type="submit" disabled={linkRatio < MIN_CONTRAST}>
				{t('theme.save')}
			</button>
		</form>

		<section class="preview-wrap" aria-label={t('theme.preview')}>
			<h2>{t('theme.preview')}</h2>
			<div class="preview" bind:this={preview}>
				<div class="bar">{data.tenant.name}</div>
				<div class="body stack">
					<p>
						{t('theme.preview_text')}
						<a href="#preview-link" onclick={(e) => e.preventDefault()}>{t('theme.preview_link')}</a
						>
					</p>
					<div class="row">
						<button class="btn btn-primary" type="button">{t('theme.preview_button')}</button>
						<span class="badge">{t('theme.preview_badge')}</span>
					</div>
					<input aria-label={t('theme.preview_input')} placeholder={t('theme.preview_input')} />
				</div>
			</div>
		</section>
	</div>

	<form method="POST" action="?/reset">
		<button class="btn-link" type="submit">{t('theme.reset')}</button>
	</form>
</div>

<style>
	.page {
		max-width: 64rem;
	}

	.layout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: calc(var(--ra-space-unit) * 4);
		align-items: start;
	}

	.colors {
		display: flex;
		gap: calc(var(--ra-space-unit) * 2);
	}

	input[type='color'] {
		width: 5rem;
		padding: 2px;
	}

	.check {
		display: flex;
		align-items: center;
		gap: var(--ra-space-unit);
		min-height: 44px;
	}

	.check input {
		width: 1.25rem;
		height: 1.25rem;
		min-height: 0;
	}

	.preview-wrap h2 {
		margin-top: 0;
		font-size: 1.1rem;
	}

	.preview {
		overflow: hidden;
		border: 1px solid var(--ra-border);
		border-radius: var(--ra-radius);
		font-family: var(--ra-font-family);
	}

	.preview .bar {
		padding: var(--ra-space-unit) calc(var(--ra-space-unit) * 2);
		background: var(--ra-color-primary);
		color: var(--ra-color-primary-contrast);
		font-weight: 700;
	}

	.preview .body {
		padding: calc(var(--ra-space-unit) * 2);
	}

	.preview a {
		color: var(--ra-link);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--ra-space-unit);
	}

	.badge {
		padding: calc(var(--ra-space-unit) / 2) var(--ra-space-unit);
		border-radius: var(--ra-radius);
		background: var(--ra-color-secondary);
		color: var(--ra-color-secondary-contrast);
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
