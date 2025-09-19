/**
 * Agent session title update endpoint
 * Updates session title
 */

import { json } from '@sveltejs/kit';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';

/**
 * Update session title
 * @type {import('./$types').RequestHandler}
 */
export async function PUT({ request }) {
	try {
		const body = await request.json();
		const { sessionId, title } = body;
		
		if (!sessionId || !title) {
			return json(
				{ error: 'Session ID and title parameters required' },
				{ status: 400 }
			);
		}
		
		await sessionStoreFs.init();
		await sessionStoreFs.updateTitle(sessionId, title);
		
		return json({ 
			success: true,
			sessionId,
			title
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}