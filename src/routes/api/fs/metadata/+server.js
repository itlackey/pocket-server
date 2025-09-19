/**
 * File system metadata endpoint
 * Gets file or directory metadata
 */

import { json } from '@sveltejs/kit';
import { fileSystemService } from '$lib/file-system/service.js';

/**
 * Get file or directory metadata
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');
		
		if (!path) {
			return json(
				{ error: 'Path parameter required' },
				{ status: 400 }
			);
		}
		
		const result = await fileSystemService.metadata(path);
		
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