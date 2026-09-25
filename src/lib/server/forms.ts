// SPDX-License-Identifier: AGPL-3.0-or-later
import { error, fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { DomainError } from '$lib/server/errors';

/** Reads the named fields of a form as strings (missing → ''). */
export function formValues<K extends string>(
	form: FormData,
	keys: readonly K[]
): Record<K, string> {
	return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? '')])) as Record<K, string>;
}

/** Valibot issues → { field: i18n key } (schemas use keys as messages, ADR-0007). */
export function fieldErrors(issues: v.BaseIssue<unknown>[]): Record<string, string> {
	return Object.fromEntries(issues.map((i) => [v.getDotPath(i) ?? 'form', i.message]));
}

/**
 * Maps a DomainError from the service layer to an HTTP result: permission and lookup failures
 * become error pages, anything else a form failure with the i18n code.
 */
export function domainFailure(err: unknown, extra: Record<string, unknown> = {}) {
	if (!(err instanceof DomainError)) throw err;
	if (err.code === 'errors.forbidden') error(403, err.code);
	if (err.code === 'errors.not_found') error(404, err.code);
	return fail(400, { ...extra, error: err.code, errorParams: err.params });
}

/** For loads: a DomainError becomes an error page (403/404, otherwise 400); anything else rethrows. */
export function loadFailure(err: unknown): never {
	if (!(err instanceof DomainError)) throw err;
	if (err.code === 'errors.forbidden') error(403, err.code);
	if (err.code === 'errors.not_found') error(404, err.code);
	error(400, err.code);
}
