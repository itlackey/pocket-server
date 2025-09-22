/**
 * File system delete endpoint
 * Deletes files or directories
 */

import { json } from '@sveltejs/kit';
import { fileSystemService } from '$lib/file-system/service.js';

/**
 * Delete file or directory
 * @type {import('./$types').RequestHandler}
 */
export async function DELETE({ url }) {
	try {
		const path = url.searchParams.get('path');
		
		if (!path) {
			return json(
				{ error: 'Path parameter required' },
				{ status: 400 }
			);
		}
		
		const result = await fileSystemService.delete(path);
		
		if (!result.ok) {
			return json(
				{ error: result.error.message },
				{ status: 400 }
			);
		}
		
		return json({ success: true });
	} catch (error) {
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}