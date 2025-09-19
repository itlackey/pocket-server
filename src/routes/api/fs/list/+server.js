/**
 * File system list endpoint
 * Converted from Hono to SvelteKit API route
 */

import { json } from '@sveltejs/kit';
import { homedir } from 'os';

// For now, create a simple placeholder implementation
// We'll need to convert the fileSystemService next

/**
 * List directory contents
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path') || homedir();
		
		// TODO: Import and use converted fileSystemService
		// For now, return a placeholder response
		return json({
			path,
			entries: [],
			message: 'File system service not yet converted'
		});
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 400 }
		);
	}
}