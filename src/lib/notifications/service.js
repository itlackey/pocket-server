/**
 * Notifications Service
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Push notification system for mobile apps with Expo integration
 *
 * @fileoverview Push notification service for mobile app integration
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { logger } from '$lib/shared/logger.js';
import { resolveDataPath } from '$lib/shared/paths.js';

/**
 * @typedef {'ios' | 'android'} Platform
 */

/**
 * @typedef {Object} PushDevice
 * @property {string} deviceId - Unique device identifier
 * @property {string} expoPushToken - Expo push token
 * @property {Platform} platform - Device platform
 * @property {string[]} [subscriptions] - Notification subscriptions
 * @property {string} lastSeen - Last seen timestamp (ISO string)
 */

/**
 * @typedef {Object} NotificationMessage
 * @property {string} title - Notification title
 * @property {string} [body] - Notification body
 * @property {Record<string, unknown>} [data] - Additional data
 */

const DEVICES_PATH = resolveDataPath('notifications', 'devices.json');

/**
 * Ensure notification registry directory and file exist
 */
function ensureRegistry() {
  const dir = dirname(DEVICES_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(DEVICES_PATH)) {
    writeFileSync(DEVICES_PATH, JSON.stringify([]), 'utf8');
  }
}

/**
 * Load registered push devices
 * @returns {PushDevice[]} Array of registered devices
 */
function loadDevices() {
  try {
    ensureRegistry();
    const raw = readFileSync(DEVICES_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    logger.error('Notifications', 'load_devices_failed', e);
    return [];
  }
}

/**
 * Save registered push devices
 * @param {PushDevice[]} devices - Devices to save
 */
function saveDevices(devices) {
  try {
    ensureRegistry();
    writeFileSync(DEVICES_PATH, JSON.stringify(devices, null, 2), 'utf8');
  } catch (e) {
    logger.error('Notifications', 'save_devices_failed', e);
  }
}

/**
 * Validate Expo push token format
 * @param {string} token - Token to validate
 * @returns {boolean} Whether token is valid
 */
function isValidExpoToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

/**
 * Send push notifications via Expo service
 * @param {Array<{to: string, title: string, body?: string, data?: Record<string, unknown>}>} messages - Messages to send
 */
async function sendExpoPush(messages) {
  if (!messages.length) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Notifications', 'expo_push_failed', { status: response.status, text });
    } else {
      logger.info('Notifications', 'expo_push_sent', { count: messages.length });
    }
  } catch (e) {
    logger.error('Notifications', 'expo_push_error', e);
  }
}

/**
 * Truncate string to specified length
 * @param {string} s - String to truncate
 * @param {number} n - Maximum length
 * @returns {string} Truncated string
 */
function truncate(s, n) {
  if (!s) return s;
  return s.length <= n ? s : (s.slice(0, n - 1) + '…');
}

/**
 * Notifications Service
 * Manages push notifications for mobile devices
 */
export const notificationsService = {
  /**
   * Register a push device
   * @param {Object} input - Registration input
   * @param {string} input.deviceId - Device identifier
   * @param {string} input.expoPushToken - Expo push token
   * @param {Platform} input.platform - Device platform
   * @param {string[]} [input.subscriptions] - Notification subscriptions
   * @returns {PushDevice | null} Registered device or null if invalid
   */
  registerDevice(input) {
    const { deviceId, expoPushToken, platform, subscriptions } = input;

    if (!deviceId || !expoPushToken || !platform) return null;

    if (!isValidExpoToken(expoPushToken)) {
      logger.warn('Notifications', 'invalid_expo_token', { deviceId });
      return null;
    }

    const devices = loadDevices();
    const now = new Date().toISOString();
    const idx = devices.findIndex(d => d.deviceId === deviceId);

    const updated = {
      deviceId,
      expoPushToken,
      platform,
      subscriptions,
      lastSeen: now
    };

    if (idx >= 0) {
      devices[idx] = { ...devices[idx], ...updated };
    } else {
      devices.push(updated);
    }

    saveDevices(devices);
    logger.info('Notifications', 'device_registered', { deviceId, platform });
    return updated;
  },

  /**
   * Unregister a push device
   * @param {Object} input - Unregistration input
   * @param {string} input.deviceId - Device identifier
   * @returns {boolean} Whether device was removed
   */
  unregisterDevice(input) {
    const { deviceId } = input;
    const devices = loadDevices();
    const before = devices.length;
    const after = devices.filter(d => d.deviceId !== deviceId);

    if (after.length !== before) {
      saveDevices(after);
      logger.info('Notifications', 'device_unregistered', { deviceId });
      return true;
    }

    return false;
  },

  /**
   * Send notification when cloud agent completes
   * @param {Object} payload - Notification payload
   * @param {string} payload.id - Agent ID
   * @param {string} payload.status - Agent status
   * @param {string} [payload.summary] - Agent summary
   * @param {Object} [payload.target] - Agent target
   * @param {string} [payload.target.url] - Target URL
   * @param {string} [payload.target.prUrl] - PR URL
   * @param {string} [payload.target.branchName] - Branch name
   */
  async notifyCloudAgentCompleted(payload) {
    const devices = loadDevices();
    if (!devices.length) return;

    const title = payload.status === 'FINISHED'
      ? 'Cloud agent completed'
      : payload.status === 'ERROR'
      ? 'Cloud agent failed'
      : 'Cloud agent expired';

    const body = payload.summary ||
      payload.target?.branchName ||
      payload.target?.url ||
      payload.target?.prUrl ||
      payload.id;

    const url = `/cloud-agents?agentId=${encodeURIComponent(payload.id)}`;

    const messages = devices.map(d => ({
      to: d.expoPushToken,
      title,
      body,
      data: { url, agentId: payload.id, status: payload.status },
    }));

    await sendExpoPush(messages);
    logger.info('Notifications', 'cloud_agent_notification_sent', {
      agentId: payload.id,
      status: payload.status,
      deviceCount: devices.length
    });
  },

  /**
   * Send notification for agent plan progress
   * @param {Object} input - Progress notification input
   * @param {string} input.deviceId - Target device ID
   * @param {string} input.sessionId - Session identifier
   * @param {string} input.sessionTitle - Session title
   * @param {'created' | 'next' | 'completed'} input.kind - Progress kind
   * @param {number} input.stepIndex - Current step (1-based when kind !== 'completed')
   * @param {number} input.total - Total steps
   * @param {string} input.taskTitle - Task title
   */
  async notifyAgentPlanProgress(input) {
    const devices = loadDevices();
    const target = devices.find(d => d.deviceId === input.deviceId);
    if (!target) return;

    const title = input.sessionTitle || 'Agent';
    const body = input.kind === 'completed'
      ? `Completed ${input.total}/${input.total} steps`
      : `Step ${input.stepIndex}/${input.total} — ${truncate(input.taskTitle, 120)}`;

    const url = `/chat?sessionId=${encodeURIComponent(input.sessionId)}`;

    await sendExpoPush([{
      to: target.expoPushToken,
      title,
      body,
      data: { url, sessionId: input.sessionId, kind: input.kind }
    }]);

    logger.info('Notifications', 'plan_progress_notification_sent', {
      deviceId: input.deviceId,
      sessionId: input.sessionId,
      kind: input.kind,
      step: input.stepIndex,
      total: input.total
    });
  },

  /**
   * Send a generic notification
   * @param {NotificationMessage & {deviceId?: string}} message - Notification message
   */
  async sendNotification(message) {
    const devices = loadDevices();
    if (!devices.length) return;

    const targets = message.deviceId
      ? devices.filter(d => d.deviceId === message.deviceId)
      : devices;

    if (!targets.length) return;

    const messages = targets.map(d => ({
      to: d.expoPushToken,
      title: message.title,
      body: message.body,
      data: message.data || {},
    }));

    await sendExpoPush(messages);
    logger.info('Notifications', 'generic_notification_sent', {
      title: message.title,
      deviceCount: targets.length,
      targetDevice: message.deviceId
    });
  },

  /**
   * Get registered devices
   * @returns {PushDevice[]} Array of registered devices
   */
  getDevices() {
    return loadDevices();
  },

  /**
   * Get notification service status
   * @returns {Object} Service status
   */
  getStatus() {
    const devices = loadDevices();
    const byPlatform = devices.reduce((acc, device) => {
      acc[device.platform] = (acc[device.platform] || 0) + 1;
      return acc;
    }, {});

    return {
      totalDevices: devices.length,
      byPlatform,
      recentDevices: devices
        .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
        .slice(0, 5)
        .map(d => ({
          deviceId: d.deviceId,
          platform: d.platform,
          lastSeen: d.lastSeen
        }))
    };
  }
};