// SPDX-License-Identifier: AGPL-3.0-or-later
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { runtime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

/** Liveness + database reachability for container health checks. Reveals nothing else. */
export const GET: RequestHandler = async () => {
	try {
		await sql`SELECT 1`.execute(runtime().db);
		return json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return json(
			{ status: 'unavailable' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};
