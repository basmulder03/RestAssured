<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { useT } from '$lib/i18n/context';

	let { data, form } = $props();
	const t = useT();
</script>

<svelte:head>
	<title>{t('auth.sign_in')} · {t('common.app_name')}</title>
</svelte:head>

<section class="card">
	<form method="POST" class="stack">
		<h1>{t('auth.sign_in')}</h1>
		{#if form?.error}
			<p class="alert alert-error" role="alert">{t(form.error)}</p>
		{/if}
		<input type="hidden" name="next" value={data.next} />
		<div class="field">
			<label for="email">{t('auth.email')}</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="username"
				required
				value={form?.email ?? ''}
			/>
		</div>
		<div class="field">
			<label for="password">{t('auth.password')}</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button class="btn btn-primary" type="submit">{t('auth.sign_in')}</button>
		<p class="muted">{t('auth.no_password_hint')}</p>
	</form>
</section>
