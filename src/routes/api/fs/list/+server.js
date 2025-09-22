/**
 * File system list endpoint
 * Lists directory contents with full file system service
 */

import { json } from '@sveltejs/kit';
import { homedir } from 'os';
import { fileSystemService } from '$lib/file-system/service.js';

/**
 * List directory contents
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path') || homedir();
		
		const result = await fileSystemService.list(path);
		
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