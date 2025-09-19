/**
 * Device status endpoint
 * Converted from Hono auth routes to SvelteKit API
 */

import { json } from '@sveltejs/kit';
import { getDevice } from '$lib/auth/device-registry.js';

/**
 * Check if a device is registered
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
	try {
		const deviceId = url.searchParams.get('deviceId') || '';
		const device = deviceId ? getDevice(deviceId) : undefined;
		
		return json({
			registered: !!device && !device.revoked
		});
	} catch (e) {
		return json({
			registered: false
		});
	}
}