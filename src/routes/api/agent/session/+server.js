/**
 * Agent session creation endpoint  
 * Converted from Hono to SvelteKit API route with working session store
 */

import { json } from '@sveltejs/kit';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';

/**
 * Create a new agent session
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { workingDir = process.cwd(), maxMode = false, title } = body || {};
		
		// Initialize store if needed
		await sessionStoreFs.init();
		
		// Create session using converted store
		const id = await sessionStoreFs.createSession({
			workingDir,
			maxMode,
			title
		});
		
		return json({ 
			id,
			workingDir,
			maxMode,
			title: title || 'New Chat',
			message: 'Session created successfully'
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}