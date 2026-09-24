// SPDX-License-Identifier: AGPL-3.0-or-later
import { getContext, setContext } from 'svelte';
import { createTranslator, type Locale, type Translate } from './index';

const KEY = Symbol('i18n');

/** Called by the root layout; `getLocale` is reactive so navigation can change language. */
export function setI18n(getLocale: () => Locale): void {
	setContext(KEY, getLocale);
}

export function useT(): Translate {
	const getLocale = getContext<() => Locale>(KEY);
	return (key, params) => createTranslator(getLocale())(key, params);
}
