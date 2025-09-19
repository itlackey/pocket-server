/**
 * SvelteKit hooks for Pocket Server
 * This will handle the server initialization and WebSocket setup
 */

import { sequence } from '@sveltejs/kit/hooks';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = sequence(
	// First handle function - could add auth middleware here
	async ({ event, resolve }) => {
		// TODO: Add authentication middleware for protected routes
		return resolve(event);
	}
);

/** @type {import('@sveltejs/kit').HandleServerError} */
export const handleError = ({ error, event }) => {
	console.error('Server error:', error);
	return {
		message: 'Internal error'
	};
};