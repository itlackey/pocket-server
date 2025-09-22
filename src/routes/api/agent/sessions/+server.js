/**
 * Agent sessions list endpoint
 * Lists all agent sessions
 */

import { json } from '@sveltejs/kit';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';

/**
 * List all agent sessions
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	try {
		await sessionStoreFs.init();
		const sessions = await sessionStoreFs.listSessions();
		
		return json({
			sessions,
			count: sessions.length
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}