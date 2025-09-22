/**
 * Agent session clear endpoint
 * Clears session conversation
 */

import { json } from '@sveltejs/kit';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';

/**
 * Clear session conversation
 * @type {import('./$types').RequestHandler}
 */
export async function DELETE({ url }) {
	try {
		const sessionId = url.searchParams.get('sessionId');
		
		if (!sessionId) {
			return json(
				{ error: 'Session ID parameter required' },
				{ status: 400 }
			);
		}
		
		await sessionStoreFs.init();
		await sessionStoreFs.clearSession(sessionId);
		
		return json({ 
			success: true,
			sessionId,
			message: 'Session cleared successfully'
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}