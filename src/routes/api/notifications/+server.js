/**
 * Notifications API Routes
 * Device registration and notification management
 */

import { json } from '@sveltejs/kit';
import { verifyAuthFromRequest } from '$lib/auth/middleware.js';
import { logger } from '$lib/shared/logger.js';

/**
 * Get notification service status
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ request }) {
  try {
    // Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.ok) {
      return json({ error: auth.reason }, { status: auth.status });
    }

    // Import service dynamically
    const { notificationsService } = await import('$lib/notifications/service.js');
    const status = notificationsService.getStatus();

    return json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('NotificationsAPI', 'status_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Register a device for push notifications
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
    const { deviceId, expoPushToken, platform, subscriptions } = body || {};

    if (!deviceId || !expoPushToken || !platform) {
      return json({
        error: 'Missing required fields: deviceId, expoPushToken, platform'
      }, { status: 400 });
    }

    // Import service dynamically
    const { notificationsService } = await import('$lib/notifications/service.js');

    const registered = notificationsService.registerDevice({
      deviceId,
      expoPushToken,
      platform,
      subscriptions
    });

    if (!registered) {
      return json({
        error: 'Failed to register device - invalid input'
      }, { status: 400 });
    }

    return json({
      success: true,
      device: registered
    });

  } catch (error) {
    logger.error('NotificationsAPI', 'register_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Unregister a device from push notifications
 * @type {import('./$types').RequestHandler}
 */
export async function DELETE({ request }) {
  try {
    // Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.ok) {
      return json({ error: auth.reason }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const { deviceId } = body || {};

    if (!deviceId) {
      return json({
        error: 'Missing required field: deviceId'
      }, { status: 400 });
    }

    // Import service dynamically
    const { notificationsService } = await import('$lib/notifications/service.js');

    const removed = notificationsService.unregisterDevice({ deviceId });

    return json({
      success: true,
      removed
    });

  } catch (error) {
    logger.error('NotificationsAPI', 'unregister_error', error);
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
}