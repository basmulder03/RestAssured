// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0003: the permission catalogue. Code is the source of truth; migrations sync it to the
// `permissions` table. Labels live in locales/*/perm.json under `perm.<resource>.<action>.*`.

export const PERMISSION_GROUPS = [
	'assets',
	'assignments',
	'members',
	'roles',
	'financials',
	'tenant',
	'audit',
	'data'
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

type PermissionDef = { code: `${string}:${string}`; group: PermissionGroup; dangerous: boolean };

export const PERMISSIONS = [
	{ code: 'assets:view', group: 'assets', dangerous: false },
	{ code: 'assets:create', group: 'assets', dangerous: false },
	{ code: 'assets:edit', group: 'assets', dangerous: false },
	{ code: 'assets:delete', group: 'assets', dangerous: false },
	{ code: 'assets:view_financials', group: 'assets', dangerous: false },
	{ code: 'assignments:view', group: 'assignments', dangerous: false },
	{ code: 'assignments:manage', group: 'assignments', dangerous: false },
	{ code: 'members:view', group: 'members', dangerous: false },
	{ code: 'members:manage', group: 'members', dangerous: false },
	{ code: 'members:invite', group: 'members', dangerous: false },
	{ code: 'members:reset_password', group: 'members', dangerous: true },
	{ code: 'members:anonymize', group: 'members', dangerous: true },
	{ code: 'members:export_data', group: 'members', dangerous: false },
	{ code: 'roles:view', group: 'roles', dangerous: false },
	{ code: 'roles:manage', group: 'roles', dangerous: true },
	{ code: 'financials:read_forecasts', group: 'financials', dangerous: false },
	{ code: 'financials:configure_forecasts', group: 'financials', dangerous: false },
	{ code: 'tenant:manage_settings', group: 'tenant', dangerous: false },
	{ code: 'tenant:manage_theme', group: 'tenant', dangerous: false },
	{ code: 'audit:view', group: 'audit', dangerous: false },
	{ code: 'data:import', group: 'data', dangerous: false },
	{ code: 'data:export', group: 'data', dangerous: false }
] as const satisfies readonly PermissionDef[];

export type Permission = (typeof PERMISSIONS)[number]['code'];

export function permissionLabelKey(code: Permission): string {
	return `perm.${code.replace(':', '.')}.label`;
}

export function permissionDescriptionKey(code: Permission): string {
	return `perm.${code.replace(':', '.')}.description`;
}

export function permissionGroupKey(group: PermissionGroup): string {
	return `perm.group.${group}`;
}
