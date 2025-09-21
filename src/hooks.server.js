/**
 * SvelteKit hooks for Dispatch Server
 * This will handle the server initialization and WebSocket setup
 */

import { sequence } from '@sveltejs/kit/hooks';
import { wsManager } from '$lib/websocket.js';
import { getOrCreateLocalWsSecret } from '$lib/auth/local-ws.js';

// Initialize local WebSocket secret on startup
try { 
  getOrCreateLocalWsSecret(); 
} catch (error) {
  console.error('Failed to initialize local WebSocket secret:', error);
}

// Track if WebSocket server is initialized
let wsInitialized = false;

/** @type {import('@sveltejs/kit').Handle} */
export const handle = sequence(
  // WebSocket initialization middleware
  async ({ event, resolve }) => {
    // Initialize WebSocket server on first request if not already done
    if (!wsInitialized && event.platform?.server) {
      try {
        wsManager.initialize(event.platform.server);
        wsInitialized = true;
        console.log('✅ WebSocket server initialized');
      } catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error);
      }
    }
    
    return resolve(event);
  },
  
  // Authentication middleware for protected routes
  async ({ event, resolve }) => {
    // Add CORS headers for API routes
    if (event.url.pathname.startsWith('/api/')) {
      const response = await resolve(event);
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }
    
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
