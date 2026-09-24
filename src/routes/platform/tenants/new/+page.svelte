<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import LinkShare from '$lib/components/LinkShare.svelte';
	import { useT } from '$lib/i18n/context';

	let { data, form } = $props();
	const t = useT();
	const errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	const values = $derived((form && 'values' in form ? form.values : {}) as Record<string, string>);
</script>

<svelte:head>
	<title>{t('platform.new_club')} · {t('common.app_name')}</title>
</svelte:head>

<section class="card wide stack">
	{#if form && 'created' in form && form.created}
		<h1>{t('platform.created_title', { club: form.created.name })}</h1>
		<p>{t('platform.created_body', { name: form.created.adminName })}</p>
		<LinkShare
			url={form.created.link}
			expiresAt={form.created.expiresAt}
			qrSvg={form.created.qrSvg}
			locale={data.locale}
		/>
		<p><a href={resolve('/platform')}>{t('platform.back_to_list')}</a></p>
	{:else}
		<form method="POST" class="stack">
			<h1>{t('platform.new_club')}</h1>
			{#if errors.form}
				<p class="alert alert-error" role="alert">{t(errors.form, { slug: values.slug ?? '' })}</p>
			{/if}
			<div class="field">
				<label for="name">{t('platform.club_name')}</label>
				<input
					id="name"
					name="name"
					required
					maxlength="200"
					value={values.name ?? ''}
					aria-invalid={!!errors.name}
				/>
				{#if errors.name}<span class="hint">{t(errors.name)}</span>{/if}
			</div>
			<div class="field">
				<label for="slug">{t('platform.club_slug')}</label>
				<input
					id="slug"
					name="slug"
					required
					maxlength="63"
					value={values.slug ?? ''}
					aria-invalid={!!errors.slug}
					aria-describedby="slug-hint"
				/>
				<span class="hint" id="slug-hint"
					>{errors.slug ? t(errors.slug) : t('platform.slug_hint')}</span
				>
			</div>
			<div class="field">
				<label for="defaultLocale">{t('platform.club_language')}</label>
				<select id="defaultLocale" name="defaultLocale">
					<option value="nl" selected={values.defaultLocale !== 'en'}>Nederlands</option>
					<option value="en" selected={values.defaultLocale === 'en'}>English</option>
				</select>
			</div>
			<h2>{t('platform.first_admin')}</h2>
			<div class="field">
				<label for="adminName">{t('platform.admin_name')}</label>
				<input
					id="adminName"
					name="adminName"
					required
					maxlength="200"
					value={values.adminName ?? ''}
					aria-invalid={!!errors.adminName}
				/>
				{#if errors.adminName}<span class="hint">{t(errors.adminName)}</span>{/if}
			</div>
			<div class="field">
				<label for="adminEmail">{t('auth.email')}</label>
				<input
					id="adminEmail"
					name="adminEmail"
					type="email"
					required
					value={values.adminEmail ?? ''}
					aria-invalid={!!errors.adminEmail}
				/>
				{#if errors.adminEmail}<span class="hint">{t(errors.adminEmail)}</span>{/if}
			</div>
			<button class="btn btn-primary" type="submit">{t('platform.create_club')}</button>
		</form>
	{/if}
</section>
