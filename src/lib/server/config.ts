// SPDX-License-Identifier: AGPL-3.0-or-later
import * as v from 'valibot';
import { LOCALES } from '../i18n/locales';

const postgresUrl = v.pipe(
	v.string(),
	v.regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection URL')
);

const boolFlag = v.pipe(
	v.optional(v.picklist(['true', 'false']), 'true'),
	v.transform((s) => s === 'true')
);

const ConfigSchema = v.object({
	RA_DATABASE_URL: postgresUrl,
	RA_DATABASE_OWNER_URL: v.optional(postgresUrl),
	RA_MIGRATE_ON_START: boolFlag,
	RA_DEFAULT_LOCALE: v.optional(v.picklist(LOCALES), 'nl'),
	// ADR-0009: defaults to upstream; operators of modified versions must point it at their source.
	RA_SOURCE_URL: v.optional(
		v.pipe(v.string(), v.url()),
		'https://github.com/basmulder03/RestAssured'
	)
});

export type Config = {
	databaseUrl: string;
	databaseOwnerUrl: string | undefined;
	migrateOnStart: boolean;
	defaultLocale: (typeof LOCALES)[number];
	sourceUrl: string;
};

/** Parses and validates environment variables. Throws with every problem listed. */
export function loadConfig(env: Record<string, string | undefined>): Config {
	const result = v.safeParse(ConfigSchema, env);
	if (!result.success) {
		const problems = result.issues.map((i) => `${v.getDotPath(i) ?? '?'}: ${i.message}`);
		throw new Error(`Invalid configuration:\n  ${problems.join('\n  ')}`);
	}
	const c = result.output;
	if (c.RA_MIGRATE_ON_START && !c.RA_DATABASE_OWNER_URL) {
		throw new Error(
			'Invalid configuration:\n  RA_DATABASE_OWNER_URL is required when RA_MIGRATE_ON_START=true'
		);
	}
	return {
		databaseUrl: c.RA_DATABASE_URL,
		databaseOwnerUrl: c.RA_DATABASE_OWNER_URL,
		migrateOnStart: c.RA_MIGRATE_ON_START,
		defaultLocale: c.RA_DEFAULT_LOCALE,
		sourceUrl: c.RA_SOURCE_URL
	};
}
