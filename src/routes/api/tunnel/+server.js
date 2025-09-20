/**
 * Tunnel API Routes
 * Cloudflare tunnel management endpoints
 */

import { json } from '@sveltejs/kit';
import { verifyAuthFromRequest } from '$lib/auth/middleware.js';
import { logger } from '$lib/shared/logger.js';

/**
 * Get tunnel status
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ request }) {
  try {
    // Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.ok) {
      return json({ error: auth.reason }, { status: auth.status });
    }

    // Import manager dynamically
    const { tunnelManager } = await import('$lib/tunnel/manager.js');
    const status = tunnelManager.getStatus();

    return json({
      success: true,
      tunnel: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('TunnelAPI', 'status_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Start or control tunnel
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
  try {
    // Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.ok) {
      return json({ error: auth.reason }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const { action, port = 3000 } = body || {};

    if (!action) {
      return json({
        error: 'Action is required (start, stop, restart)'
      }, { status: 400 });
    }

    // Import manager dynamically
    const { tunnelManager } = await import('$lib/tunnel/manager.js');

    switch (action) {
      case 'start': {
        const url = await tunnelManager.startTunnel(port);
        return json({
          success: true,
          action: 'start',
          url,
          port
        });
      }

      case 'stop': {
        const stopped = tunnelManager.stopTunnel();
        return json({
          success: true,
          action: 'stop',
          stopped
        });
      }

      case 'restart': {
        const url = await tunnelManager.restartTunnel(port);
        return json({
          success: true,
          action: 'restart',
          url,
          port
        });
      }

      default:
        return json({
          error: 'Invalid action. Use: start, stop, or restart'
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('TunnelAPI', 'action_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}