<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useT } from '$lib/i18n/context';

	const t = useT();
	const messageKey = $derived(
		page.status === 404
			? 'errors.not_found'
			: page.status === 403
				? 'errors.forbidden'
				: 'errors.internal'
	);
</script>

<svelte:head>
	<title>{page.status} · {t('common.app_name')}</title>
</svelte:head>

<h1>{page.status}</h1>
<p>{t(messageKey)}</p>
<p><a href={resolve('/')}>{t('errors.back_home')}</a></p>
