/**
 * Tunnel Manager
 * Tunnel management and monitoring system
 *
 * @fileoverview Centralized tunnel management
 */

import { EventEmitter } from 'events';
import { logger } from '$lib/shared/logger.js';
import { startQuickTunnel, getTunnelStatus } from './cloudflare.js';

/**
 * @typedef {Object} TunnelStatus
 * @property {boolean} active - Whether tunnel is active
 * @property {string} [url] - Public tunnel URL
 * @property {boolean} binaryInstalled - Whether cloudflared is installed
 * @property {string} binaryPath - Path to cloudflared binary
 * @property {string} timestamp - Status timestamp
 */

/**
 * Tunnel Manager
 * Manages tunnel lifecycle and monitoring
 */
class TunnelManager extends EventEmitter {
  constructor() {
    super();

    /** @type {import('./cloudflare.js').TunnelProcess | null} */
    this.activeTunnel = null;

    /** @type {boolean} */
    this.isStarting = false;

    /** @type {number | null} */
    this.healthCheckInterval = null;
  }

  /**
   * Start a tunnel for the specified port
   * @param {number} port - Port to expose
   * @returns {Promise<string>} Tunnel URL
   */
  async startTunnel(port) {
    if (this.activeTunnel) {
      throw new Error('Tunnel already active');
    }

    if (this.isStarting) {
      throw new Error('Tunnel start already in progress');
    }

    this.isStarting = true;

    try {
      logger.info('TunnelManager', 'starting_tunnel', { port });

      const tunnel = await startQuickTunnel(port);
      this.activeTunnel = tunnel;

      // Handle tunnel process exit
      tunnel.process.on('exit', (code) => {
        logger.warn('TunnelManager', 'tunnel_exited', { code });
        this.activeTunnel = null;
        this.emit('tunnel:stopped', { code });
        this.stopHealthCheck();
      });

      // Wait for URL
      const url = await tunnel.urlPromise;

      logger.info('TunnelManager', 'tunnel_started', { url, port });
      this.emit('tunnel:started', { url, port });

      // Start health monitoring
      this.startHealthCheck();

      return url;

    } catch (error) {
      logger.error('TunnelManager', 'tunnel_start_failed', { port, error: error.message });
      this.activeTunnel = null;
      this.emit('tunnel:error', { error: error.message });
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop the active tunnel
   * @returns {boolean} Whether tunnel was stopped
   */
  stopTunnel() {
    if (!this.activeTunnel) {
      return false;
    }

    logger.info('TunnelManager', 'stopping_tunnel');

    try {
      this.activeTunnel.process.kill('SIGTERM');
      this.activeTunnel = null;
      this.stopHealthCheck();

      logger.info('TunnelManager', 'tunnel_stopped');
      this.emit('tunnel:stopped', { manual: true });

      return true;
    } catch (error) {
      logger.error('TunnelManager', 'tunnel_stop_failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get current tunnel status
   * @returns {TunnelStatus & {isStarting: boolean}} Enhanced tunnel status
   */
  getStatus() {
    const baseStatus = getTunnelStatus();

    return {
      ...baseStatus,
      isStarting: this.isStarting,
      processActive: !!this.activeTunnel,
      healthCheckActive: !!this.healthCheckInterval
    };
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check on active tunnel
   */
  async performHealthCheck() {
    if (!this.activeTunnel) {
      this.stopHealthCheck();
      return;
    }

    try {
      const status = this.getStatus();

      if (status.active && status.url) {
        // Try to access the health endpoint through the tunnel
        const response = await fetch(`${status.url}/api/health`, {
          timeout: 10000
        });

        if (response.ok) {
          logger.debug('TunnelManager', 'health_check_passed', { url: status.url });
          this.emit('tunnel:healthy', { url: status.url });
        } else {
          logger.warn('TunnelManager', 'health_check_failed', {
            url: status.url,
            status: response.status
          });
          this.emit('tunnel:unhealthy', { url: status.url, status: response.status });
        }
      }
    } catch (error) {
      logger.warn('TunnelManager', 'health_check_error', {
        error: error.message
      });
      this.emit('tunnel:unhealthy', { error: error.message });
    }
  }

  /**
   * Restart the tunnel (stop and start)
   * @param {number} port - Port to expose
   * @returns {Promise<string>} New tunnel URL
   */
  async restartTunnel(port) {
    if (this.activeTunnel) {
      this.stopTunnel();
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return await this.startTunnel(port);
  }

  /**
   * Dispose the manager
   */
  dispose() {
    this.stopTunnel();
    this.stopHealthCheck();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const tunnelManager = new TunnelManager();