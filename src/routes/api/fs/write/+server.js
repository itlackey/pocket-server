/**
 * File system write endpoint
 * Writes file contents
 */

import { json } from '@sveltejs/kit';
import { fileSystemService } from '$lib/file-system/service.js';

/**
 * Write file contents
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { path, content } = body;
		
		if (!path || content === undefined) {
			return json(
				{ error: 'Path and content parameters required' },
				{ status: 400 }
			);
		}
		
		const result = await fileSystemService.write(path, content);
		
		if (!result.ok) {
			return json(
				{ error: result.error.message },
				{ status: 400 }
			);
		}
		
		return json(result.value);
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}