<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';

	let { data, form } = $props();
	const t = useT();
</script>

<svelte:head>
	<title>{t('account.title')} · {t('common.app_name')}</title>
</svelte:head>

<section class="card wide stack">
	<h1>{t('account.title')}</h1>
	{#if data.welcome}
		<p class="alert alert-success">{t('account.welcome')}</p>
	{/if}
	<p>{t('account.signed_in_as', { email: data.email })}</p>
	{#if data.scoped}
		<p class="alert">{t('account.scoped_notice')}</p>
	{/if}

	<form method="POST" action="?/password" class="stack">
		<h2>{data.hasPassword ? t('account.change_password') : t('account.set_password')}</h2>
		{#if !data.hasPassword}
			<p class="muted">{t('account.password_optional')}</p>
		{/if}
		{#if form?.passwordError}
			<p class="alert alert-error" role="alert">{t(form.passwordError)}</p>
		{:else if form?.passwordSaved}
			<p class="alert alert-success" role="status">{t('account.password_saved')}</p>
		{/if}
		{#if data.hasPassword}
			<div class="field">
				<label for="current_password">{t('account.current_password')}</label>
				<input
					id="current_password"
					name="current_password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
		{/if}
		<div class="field">
			<label for="new_password">{t('account.new_password')}</label>
			<input
				id="new_password"
				name="new_password"
				type="password"
				autocomplete="new-password"
				minlength="12"
				required
			/>
			<span class="hint">{t('account.password_rules')}</span>
		</div>
		<div class="field">
			<label for="confirm_password">{t('account.confirm_password')}</label>
			<input
				id="confirm_password"
				name="confirm_password"
				type="password"
				autocomplete="new-password"
				minlength="12"
				required
			/>
		</div>
		<button class="btn btn-primary" type="submit">{t('common.save')}</button>
	</form>

	<form method="POST" action="?/language" class="stack">
		<h2>{t('account.language')}</h2>
		{#if form?.languageSaved}
			<p class="alert alert-success" role="status">{t('account.language_saved')}</p>
		{/if}
		<div class="field">
			<label for="locale">{t('account.language')}</label>
			<select id="locale" name="locale">
				<option value="" selected={!data.preferredLocale}>{t('account.language_auto')}</option>
				<option value="nl" selected={data.preferredLocale === 'nl'}>Nederlands</option>
				<option value="en" selected={data.preferredLocale === 'en'}>English</option>
			</select>
		</div>
		<button class="btn" type="submit">{t('common.save')}</button>
	</form>
</section>
