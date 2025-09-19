/**
 * Health check endpoint for Pocket Server
 * Converted from Hono to SvelteKit API route
 */

import { json } from '@sveltejs/kit';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	return json({
		status: 'ok',
		uptime: process.uptime(),
		memory: {
			used: process.memoryUsage().heapUsed,
			total: process.memoryUsage().heapTotal,
		},
		timestamp: new Date().toISOString()
	});
}