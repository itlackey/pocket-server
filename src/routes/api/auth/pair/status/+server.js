/**
 * Pairing status endpoint
 * Converted from Hono auth routes to SvelteKit API
 */

import { json } from '@sveltejs/kit';
import { isPairingActive, getPairingState } from '$lib/auth/pairing.js';

/**
 * Get current pairing status
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	try {
		const active = isPairingActive();
		const state = getPairingState();
		const expiresAt = active ? state.expiresAt ?? null : null;
		const now = Date.now();
		const secondsLeft = active && expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0;
		
		return json(
			{ active, expiresAt, secondsLeft },
			{
				headers: {
					// Disable caches for live countdowns
					'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0',
					'Surrogate-Control': 'no-store',
				},
			}
		);
	} catch (e) {
		return json(
			{ active: false, expiresAt: null, secondsLeft: 0 },
			{
				headers: {
					'Cache-Control': 'no-store',
				},
			}
		);
	}
}