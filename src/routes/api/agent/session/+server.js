/**
 * Agent session creation endpoint  
 * Converted from Hono to SvelteKit API route
 */

import { json } from '@sveltejs/kit';
import crypto from 'crypto';

/**
 * Create a new agent session
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { workingDir = process.cwd(), maxMode = false } = body || {};
		
		// TODO: Import and use converted sessionStoreFs
		// For now, create a simple session ID
		const id = crypto.randomUUID();
		
		return json({ 
			id,
			workingDir,
			maxMode,
			message: 'Session created (placeholder implementation)'
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}