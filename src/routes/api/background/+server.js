/**
 * Background Agent API Routes
 * Main API endpoint for background agent management
 */

import { json } from '@sveltejs/kit';

/**
 * Get background agent system status
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
  try {
    // Import modules dynamically to avoid initialization issues
    const { backgroundAgentManager } = await import('$lib/background-agent/manager.js');
    const { backgroundQueue } = await import('$lib/background-agent/queue.js');
    const { cursorAgentTracker } = await import('$lib/background-agent/cursor/tracker.js');

    const status = {
      manager: backgroundAgentManager.getStatus(),
      queue: backgroundQueue.getStatus(),
      tracker: cursorAgentTracker.getStatus(),
      timestamp: new Date().toISOString()
    };

    return json(status);
  } catch (error) {
    console.error('[Background API] Status error:', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Submit a background task
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, payload, options } = body || {};

    if (!type) {
      return json({ error: 'Task type is required' }, { status: 400 });
    }

    if (!payload) {
      return json({ error: 'Task payload is required' }, { status: 400 });
    }

    // Import manager dynamically
    const { backgroundAgentManager } = await import('$lib/background-agent/manager.js');

    // Submit task through manager
    const task = backgroundAgentManager.submitTask(type, payload, options);

    return json({
      success: true,
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    console.error('[Background API] Submit error:', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}