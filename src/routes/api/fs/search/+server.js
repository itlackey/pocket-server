/**
 * File system search endpoint
 * Searches for files and directories
 */

import { json } from '@sveltejs/kit';
import { fileSystemService } from '$lib/file-system/service.js';

/**
 * Search for files and directories
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const query = url.searchParams.get('query');
		const path = url.searchParams.get('path');
		const limitParam = url.searchParams.get('limit');
		const maxDepthParam = url.searchParams.get('maxDepth');
		const includeHiddenParam = url.searchParams.get('includeHidden');
		
		if (!query) {
			return json(
				{ error: 'Query parameter required' },
				{ status: 400 }
			);
		}
		
		const options = {
			query,
			path: path || undefined,
			limit: limitParam ? parseInt(limitParam, 10) : undefined,
			maxDepth: maxDepthParam ? parseInt(maxDepthParam, 10) : undefined,
			includeHidden: includeHiddenParam === 'true',
		};
		
		const result = await fileSystemService.search(options);
		
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