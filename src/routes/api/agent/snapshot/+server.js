/**
 * Agent session snapshot endpoint
 * Gets session snapshot data
 */

import { json } from '@sveltejs/kit';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';

/**
 * Get session snapshot
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const sessionId = url.searchParams.get('sessionId');
		
		if (!sessionId) {
			return json(
				{ error: 'Session ID parameter required' },
				{ status: 400 }
			);
		}
		
		await sessionStoreFs.init();
		const snapshot = await sessionStoreFs.getSnapshot(sessionId);
		
		if (!snapshot) {
			return json(
				{ error: 'Session not found' },
				{ status: 404 }
			);
		}
		
		return json(snapshot);
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}