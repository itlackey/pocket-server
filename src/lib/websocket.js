/**
 * WebSocket handler for SvelteKit
 * Provides WebSocket support using a custom handler since SvelteKit doesn't have built-in WebSocket support
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './shared/logger.js';

/**
 * @typedef {Object} WebSocketMessage
 * @property {number} v - Protocol version
 * @property {string} id - Unique message ID  
 * @property {string} sessionId - Session ID
 * @property {string} ts - ISO timestamp
 * @property {string} type - Message type
 * @property {any} [payload] - Message payload
 * @property {number} timestamp - Unix timestamp
 * @property {string} [correlationId] - Correlation ID
 */

/**
 * @typedef {Object} WebSocketClient
 * @property {string} id - Client ID
 * @property {import('ws').WebSocket} socket - WebSocket instance
 * @property {Record<string, unknown>} [metadata] - Client metadata
 */

class WebSocketManager {
  constructor() {
    /** @type {Map<string, WebSocketClient>} */
    this.clients = new Map();
    /** @type {WebSocketServer | null} */
    this.wss = null;
  }

  /**
   * Initialize WebSocket server
   * @param {import('http').Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = crypto.randomUUID();
      
      // TODO: Add token verification from query params
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || '';
      const localSecret = url.searchParams.get('local') || '';

      logger.websocket('client_connected', clientId);

      const client = {
        id: clientId,
        socket: ws,
        metadata: {}
      };

      this.clients.set(clientId, client);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('WebSocket', 'Invalid message format', { clientId, error: error.message });
        }
      });

      ws.on('close', () => {
        logger.websocket('client_disconnected', clientId);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket', 'Client error', { clientId, error: error.message });
      });

      // Send welcome message
      this.send(clientId, {
        v: 1,
        id: crypto.randomUUID(),
        sessionId: 'system',
        ts: new Date().toISOString(),
        type: 'ws:connected',
        payload: { clientId },
        timestamp: Date.now()
      });
    });

    logger.info('WebSocket', 'Server initialized', { path: '/ws' });
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} clientId 
   * @param {WebSocketMessage} message 
   */
  handleMessage(clientId, message) {
    logger.websocket('message_received', clientId, { type: message.type });

    // Handle ping/pong for heartbeat
    if (message.type === 'ping') {
      this.send(clientId, {
        v: 1,
        id: crypto.randomUUID(),
        sessionId: message.sessionId || 'system',
        ts: new Date().toISOString(),
        type: 'pong',
        payload: {},
        timestamp: Date.now(),
        correlationId: message.id
      });
      return;
    }

    // Route messages based on type prefix
    if (message.type?.startsWith('term:')) {
      // TODO: Handle terminal messages
      logger.debug('Terminal message received', message.type);
      return;
    }
    
    if (message.type?.startsWith('agent:')) {
      // TODO: Handle agent messages  
      logger.debug('Agent message received', message.type);
      return;
    }
    
    if (message.type?.startsWith('fs:')) {
      // TODO: Handle file system messages
      logger.debug('File system message received', message.type);
      return;
    }

    logger.warn('WebSocket', 'Unhandled message type', { type: message.type, clientId });
  }

  /**
   * Send message to specific client
   * @param {string} clientId
   * @param {WebSocketMessage} message
   */
  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== 1) { // WebSocket.OPEN
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('WebSocket', 'Send failed', { clientId, error: error.message });
      return false;
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {WebSocketMessage} message
   */
  broadcast(message) {
    let sent = 0;
    for (const [clientId, client] of this.clients) {
      if (this.send(clientId, message)) {
        sent++;
      }
    }
    logger.websocket('message_broadcast', 'all', { sent, total: this.clients.size });
    return sent;
  }

  /**
   * Get number of connected clients
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get client by ID
   * @param {string} clientId
   * @returns {WebSocketClient | undefined}
   */
  getClient(clientId) {
    return this.clients.get(clientId);
  }

  /**
   * Close all connections and cleanup
   */
  close() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    logger.info('WebSocket', 'Server closed');
  }
}

export const wsManager = new WebSocketManager();