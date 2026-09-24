<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import LinkShare from '$lib/components/LinkShare.svelte';
	import MemberFields from '$lib/components/MemberFields.svelte';
	import type { Permission } from '$lib/domain/permissions';
	import { useT } from '$lib/i18n/context';
	import { entityLabel, memberName } from '$lib/i18n/labels';

	let { data, form } = $props();
	const t = useT();
	const can = (p: Permission) => data.tenant.permissions.includes(p);
	const m = $derived(data.member);
	const active = $derived(m.status === 'active');
	const editable = $derived(m.status !== 'anonymized' && data.tenant.status === 'active');
	const LINK_TITLES: Record<string, string> = {
		invite: 'members.link.invite_title',
		magic_login: 'members.link.login_title',
		password_reset: 'members.link.reset_title'
	};
</script>

<svelte:head>
	<title>{memberName(t, m)} · {data.tenant.name}</title>
</svelte:head>

<div class="stack detail">
	<p>
		<a href={resolve('/t/[tenant]/members', { tenant: data.tenant.slug })}>{t('members.back')}</a>
	</p>
	<h1>{memberName(t, m)}</h1>

	{#if data.created}
		<p class="alert alert-success" role="status">{t('members.created')}</p>
	{/if}
	{#if form?.error}
		<p class="alert alert-error" role="alert">{t(form.error, form.errorParams ?? {})}</p>
	{:else if form?.saved}
		<p class="alert alert-success" role="status">{t(form.saved)}</p>
	{/if}
	{#if !active}
		<p class="alert">{t('members.inactive_notice')}</p>
	{/if}

	{#if form?.link}
		<section class="card wide stack">
			<h2>{t(LINK_TITLES[form.link.purpose] ?? 'members.link.login_title')}</h2>
			<LinkShare
				url={form.link.url}
				expiresAt={form.link.expiresAt}
				qrSvg={form.link.qrSvg}
				locale={data.locale}
			/>
		</section>
	{/if}

	<section class="stack">
		<h2>{t('members.account')}</h2>
		{#if m.hasAccount}
			<p>{m.isSelf ? t('members.account_self') : t('members.account_yes')}</p>
			{#if can('members:reset_password') && active && editable && !m.isSelf}
				<div class="actions">
					<form method="POST" action="?/loginLink">
						<button class="btn" type="submit">{t('members.issue_login_link')}</button>
					</form>
					<form method="POST" action="?/resetLink">
						<button class="btn" type="submit">{t('members.issue_reset_link')}</button>
					</form>
				</div>
				<p class="muted">{t('members.links_hint')}</p>
			{/if}
		{:else}
			<p>{t('members.account_no')}</p>
			{#if can('members:invite') && active && editable}
				{#if m.email}
					<form method="POST" action="?/invite">
						<button class="btn btn-primary" type="submit">{t('members.invite')}</button>
					</form>
				{:else}
					<p class="muted">{t('members.invite_needs_email')}</p>
				{/if}
			{/if}
		{/if}
	</section>

	{#if can('roles:view') || can('roles:manage')}
		<section class="stack">
			<h2>{t('members.roles')}</h2>
			{#if !m.hasAccount}
				<p class="muted">{t('members.roles_need_account')}</p>
			{/if}
			<form method="POST" action="?/roles" class="stack">
				<fieldset disabled={!can('roles:manage') || !editable}>
					<legend class="visually-hidden">{t('members.roles')}</legend>
					{#each data.roles as role (role.id)}
						<label class="check">
							<input
								type="checkbox"
								name="role"
								value={role.id}
								checked={m.roleIds.includes(role.id)}
							/>
							{entityLabel(t, data.locale, role)}
							{#if role.isSystem}<span class="muted">· {t('members.admin_role_hint')}</span>{/if}
						</label>
					{/each}
				</fieldset>
				{#if can('roles:manage') && editable}
					<button class="btn" type="submit">{t('members.save_roles')}</button>
				{/if}
			</form>
		</section>
	{/if}

	{#if can('members:manage') && editable}
		<section class="stack">
			<h2>{t('members.details')}</h2>
			<form method="POST" action="?/update" class="stack">
				<MemberFields
					values={form?.values ?? {
						displayName: m.displayName,
						email: m.email,
						phone: m.phone,
						memberNumber: m.memberNumber,
						notes: m.notes
					}}
					errors={form?.errors}
				/>
				<button class="btn btn-primary" type="submit">{t('common.save')}</button>
			</form>
		</section>

		<section class="stack">
			<h2>{t('members.status_heading')}</h2>
			{#if active}
				<p class="muted">{t('members.deactivate_hint')}</p>
				<form method="POST" action="?/deactivate">
					<button class="btn" type="submit">{t('members.deactivate')}</button>
				</form>
			{:else}
				<form method="POST" action="?/activate">
					<button class="btn" type="submit">{t('members.activate')}</button>
				</form>
			{/if}
		</section>
	{:else}
		<section class="stack">
			<h2>{t('members.details')}</h2>
			<dl>
				<dt>{t('members.field.email')}</dt>
				<dd>{m.email ?? '—'}</dd>
				<dt>{t('members.field.phone')}</dt>
				<dd>{m.phone ?? '—'}</dd>
				<dt>{t('members.field.member_number')}</dt>
				<dd>{m.memberNumber ?? '—'}</dd>
			</dl>
		</section>
	{/if}
</div>

<style>
	.detail {
		max-width: 40rem;
	}

	.detail h2 {
		margin-bottom: 0;
		font-size: 1.25rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--ra-space-unit);
	}

	.actions form {
		margin: 0;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--ra-space-unit);
		margin: 0;
		padding: 0;
		border: 0;
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

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--ra-space-unit) calc(var(--ra-space-unit) * 2);
	}

	dd {
		margin: 0;
	}
</style>
