/**
 * CLI Server Integration
 * Server management utilities for CLI commands
 *
 * @fileoverview CLI-based server control and monitoring
 */

import { existsSync, readFileSync } from 'fs';
import { logger } from '$lib/shared/logger.js';
import { resolveDataPath } from '$lib/shared/paths.js';

/**
 * @typedef {Object} ServerStatus
 * @property {boolean} running - Whether server is running
 * @property {number} [pid] - Process ID if running
 * @property {string} [port] - Server port
 * @property {string} [publicUrl] - Public URL if available
 * @property {string} timestamp - Status timestamp
 */

/**
 * Check if server is currently running
 * @returns {ServerStatus} Server status
 */
export function getServerStatus() {
  const pidPath = resolveDataPath('runtime', 'server.pid');
  const timestamp = new Date().toISOString();

  if (!existsSync(pidPath)) {
    return {
      running: false,
      timestamp
    };
  }

  try {
    const pid = Number(readFileSync(pidPath, 'utf8'));

    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists

      // Try to get additional server info
      const port = process.env.PORT || '3000';
      let publicUrl;

      try {
        const { getPublicBaseUrl } = await import('$lib/shared/public-url.js');
        publicUrl = getPublicBaseUrl();
      } catch {}

      return {
        running: true,
        pid,
        port,
        publicUrl,
        timestamp
      };
    } catch {
      // Process doesn't exist, clean up stale PID file
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(pidPath);
      } catch {}

      return {
        running: false,
        timestamp
      };
    }
  } catch (e) {
    logger.error('CLIServer', 'status_check_failed', { error: e.message });
    return {
      running: false,
      timestamp
    };
  }
}

/**
 * Wait for server to be ready
 * @param {number} port - Server port
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether server is ready
 */
export async function waitForServer(port, timeoutMs = 10000) {
  const startTime = Date.now();
  const url = `http://localhost:${port}/api/health`;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { timeout: 2000 });
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore errors and keep trying
    }

    // Wait 500ms before trying again
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

/**
 * Get server health information
 * @param {number} port - Server port
 * @returns {Promise<Object|null>} Health data or null if unavailable
 */
export async function getServerHealth(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/health`, { timeout: 5000 });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    logger.debug('CLIServer', 'health_check_failed', { port, error: e.message });
  }
  return null;
}

/**
 * Get comprehensive server info
 * @returns {Promise<Object>} Server information
 */
export async function getServerInfo() {
  const status = getServerStatus();

  if (!status.running) {
    return {
      ...status,
      health: null,
      services: null
    };
  }

  const port = Number(status.port || 3000);
  const health = await getServerHealth(port);

  let services = null;
  if (health) {
    try {
      // Try to get service status from various endpoints
      const [backgroundStatus, tunnelStatus] = await Promise.allSettled([
        fetch(`http://localhost:${port}/api/background`, { timeout: 2000 }).then(r => r.ok ? r.json() : null),
        fetch(`http://localhost:${port}/api/tunnel`, { timeout: 2000 }).then(r => r.ok ? r.json() : null)
      ]);

      services = {
        background: backgroundStatus.status === 'fulfilled' ? backgroundStatus.value : null,
        tunnel: tunnelStatus.status === 'fulfilled' ? tunnelStatus.value : null
      };
    } catch {}
  }

  return {
    ...status,
    health,
    services
  };
}

/**
 * CLI server management utilities
 */
export const cliServer = {
  getStatus: getServerStatus,
  waitForServer,
  getHealth: getServerHealth,
  getInfo: getServerInfo,

  /**
   * Display server status in CLI format
   * @param {boolean} verbose - Whether to show verbose output
   */
  async displayStatus(verbose = false) {
    const info = await getServerInfo();

    if (!info.running) {
      console.log('Server: Not running');
      return;
    }

    console.log(`Server: Running (PID ${info.pid})`);
    console.log(`Port: ${info.port}`);

    if (info.publicUrl) {
      console.log(`Public URL: ${info.publicUrl}`);
    }

    if (verbose && info.health) {
      console.log(`Uptime: ${Math.round(info.health.uptime || 0)}s`);
      console.log(`Memory: ${Math.round((info.health.memory?.used || 0) / 1024 / 1024)}MB`);

      if (info.services) {
        if (info.services.background) {
          const bg = info.services.background;
          console.log(`Background Agents: ${bg.manager?.agents?.total || 0} agents, ${bg.manager?.tasks?.total || 0} tasks`);
        }

        if (info.services.tunnel) {
          const tunnel = info.services.tunnel;
          console.log(`Tunnel: ${tunnel.tunnel?.active ? 'Active' : 'Inactive'}`);
        }
      }
    }
  }
};