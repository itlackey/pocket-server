/**
 * Agent Provider Management API
 * API endpoints for managing AI provider selection
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/shared/logger.js';

/**
 * Get available providers
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
  try {
    // Import manager dynamically to avoid initialization issues
    const { agentProviderManager } = await import('$lib/agent/index.js');
    const status = agentProviderManager.getStatus();

    return json({
      success: true,
      providers: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('ProviderAPI', 'status_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Set session provider
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sessionId, provider } = body || {};

    if (!sessionId) {
      return json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    if (!provider) {
      return json({
        error: 'Provider is required'
      }, { status: 400 });
    }

    // Import manager dynamically
    const { agentProviderManager } = await import('$lib/agent/index.js');

    agentProviderManager.setSessionProvider(sessionId, provider);

    return json({
      success: true,
      sessionId,
      provider,
      message: `Session ${sessionId} now using ${provider} provider`
    });

  } catch (error) {
    logger.error('ProviderAPI', 'set_provider_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}