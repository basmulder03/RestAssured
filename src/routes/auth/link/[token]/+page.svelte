<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { useT } from '$lib/i18n/context';

	let { data, form } = $props();
	const t = useT();
</script>

<svelte:head>
	<title>{t('common.app_name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="card stack">
	{#if form?.error}
		<p class="alert alert-error" role="alert">{t(form.error)}</p>
	{/if}

	{#if data.kind === 'invalid'}
		<h1>{t('links.invalid_title')}</h1>
		<p>{t('links.errors.invalid')}</p>
		<p><a href={resolve('/login')}>{t('auth.sign_in')}</a></p>
	{:else if data.kind === 'magic_login'}
		<form method="POST" action="?/login" class="stack">
			<h1>{t('links.login_title')}</h1>
			<p>{t('links.login_body')}</p>
			<button class="btn btn-primary" type="submit">{t('auth.sign_in')}</button>
		</form>
	{:else if data.kind === 'password_reset'}
		<form method="POST" action="?/reset" class="stack">
			<h1>{t('links.reset_title')}</h1>
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
			<button class="btn btn-primary" type="submit">{t('links.reset_submit')}</button>
		</form>
	{:else if data.kind === 'invite'}
		<form method="POST" action="?/invite" class="stack">
			<h1>{t('links.invite_title', { club: data.invite.tenantName })}</h1>
			<p>{t('links.invite_body', { name: data.invite.displayName, email: data.invite.email })}</p>
			{#if data.signedInAs}
				<p class="muted">{t('links.invite_signed_in_as', { email: data.signedInAs })}</p>
			{/if}
			<button class="btn btn-primary" type="submit">{t('links.invite_accept')}</button>
		</form>
	{/if}
</section>
