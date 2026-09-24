<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import MemberFields from '$lib/components/MemberFields.svelte';
	import { useT } from '$lib/i18n/context';
	import { entityLabel, memberName } from '$lib/i18n/labels';

	let { data, form } = $props();
	const t = useT();
	const canManage = $derived(data.tenant.permissions.includes('members:manage'));
	const roleNames = $derived(
		new Map(data.roles.map((r) => [r.id, entityLabel(t, data.locale, r)]))
	);
	let query = $state('');
	const visible = $derived(
		data.members.filter((m) => memberName(t, m).toLowerCase().includes(query.trim().toLowerCase()))
	);
	const STATUS_KEYS: Record<string, string> = {
		active: 'members.status.active',
		inactive: 'members.status.inactive',
		anonymized: 'members.status.anonymized'
	};
</script>

<svelte:head>
	<title>{t('members.title')} · {data.tenant.name}</title>
</svelte:head>

<div class="stack">
	<h1>{t('members.title')}</h1>
	<p class="muted">{t('members.intro')}</p>

	<div class="field search">
		<label for="q">{t('members.search')}</label>
		<input id="q" type="search" bind:value={query} />
	</div>

	{#if visible.length === 0}
		<p class="muted">{t('members.empty')}</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th scope="col">{t('members.field.display_name')}</th>
					<th scope="col">{t('members.account')}</th>
					<th scope="col">{t('members.roles')}</th>
					<th scope="col">{t('members.field.status')}</th>
				</tr>
			</thead>
			<tbody>
				{#each visible as member (member.id)}
					<tr class:inactive={member.status !== 'active'}>
						<td>
							<a
								href={resolve('/t/[tenant]/members/[id]', {
									tenant: data.tenant.slug,
									id: member.id
								})}>{memberName(t, member)}</a
							>
						</td>
						<td>{member.hasAccount ? t('members.has_account') : t('members.no_account')}</td>
						<td>{member.roleIds.map((id) => roleNames.get(id)).join(', ')}</td>
						<td>{t(STATUS_KEYS[member.status] ?? member.status)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if canManage}
		<details open={!!form?.errors}>
			<summary><h2>{t('members.add')}</h2></summary>
			<form method="POST" action="?/create" class="stack add-form">
				{#if form?.error}
					<p class="alert alert-error" role="alert">{t(form.error)}</p>
				{/if}
				<MemberFields values={form?.values} errors={form?.errors} />
				<button class="btn btn-primary" type="submit">{t('members.add')}</button>
			</form>
		</details>
	{/if}
</div>

<style>
	.search {
		max-width: 24rem;
	}

	tr.inactive td {
		color: var(--ra-text-muted);
	}

	summary h2 {
		display: inline;
		font-size: 1.25rem;
	}

	.add-form {
		max-width: 32rem;
		margin-top: calc(var(--ra-space-unit) * 2);
	}
</style>
