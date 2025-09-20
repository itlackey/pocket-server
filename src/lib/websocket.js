/**
 * WebSocket handler for SvelteKit
 * Provides WebSocket support using a custom handler since SvelteKit doesn't have built-in WebSocket support
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './shared/logger.js';
import { verifyAuthFromRequest } from './auth/middleware.js';
import { getLocalWsSecretFast } from './auth/local-ws.js';

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

/**
 * @typedef {Object} TerminalFramePayload
 * @property {string} id - Terminal ID
 * @property {number} seq - Sequence number
 * @property {number} ts - Timestamp
 * @property {string} data - Terminal data
 */

class WebSocketManager {
  constructor() {
    /** @type {Map<string, WebSocketClient>} */
    this.clients = new Map();
    /** @type {WebSocketServer | null} */
    this.wss = null;
    /** @type {Map<string, string>} Terminal ID to client ID mapping */
    this.termClientMap = new Map();
    /** @type {Map<string, {chunks: string[], bytes: number, timer: NodeJS.Timeout | null, seq: number}>} */
    this.frameBuffers = new Map();
    /** @type {Map<string, {chunks: string[], totalBytes: number, exited?: {code: number, ts: number}}>} */
    this.backlogMap = new Map();
    /** @type {Map<string, number>} */
    this.lastInputSeqByTerm = new Map();
    
    // Constants
    this.FLUSH_INTERVAL_MS = 8; // ~120Hz target
    this.MAX_FRAME_BYTES = 32 * 1024; // 32KB per frame
    this.MAX_BACKLOG_BYTES = 1024 * 1024; // 1MB backlog buffer
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

    this.wss.on('connection', async (ws, req) => {
      const clientId = crypto.randomUUID();
      
      // Verify token or local secret from query params
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || '';
      const localSecret = url.searchParams.get('local') || '';

      let authenticated = false;
      let deviceId = null;

      // Check local secret first (for CLI connections)
      if (localSecret) {
        const expectedSecret = getLocalWsSecretFast();
        if (expectedSecret && localSecret === expectedSecret) {
          authenticated = true;
          logger.websocket('local_auth_success', clientId);
        }
      }

      // Check token authentication
      if (!authenticated && token) {
        try {
          // Create a mock request for auth verification
          const mockReq = new Request('http://localhost/', {
            headers: { 'Authorization': `Pocket ${token}` }
          });
          const authResult = await verifyAuthFromRequest(mockReq);
          if (authResult.ok) {
            authenticated = true;
            deviceId = authResult.deviceId;
            logger.websocket('token_auth_success', clientId, { deviceId });
          }
        } catch (error) {
          logger.error('WebSocket', 'Auth verification failed', { clientId, error: error.message });
        }
      }

      if (!authenticated) {
        logger.websocket('auth_failed', clientId);
        ws.close(1008, 'Authentication required');
        return;
      }

      logger.websocket('client_connected', clientId, { deviceId });

      const client = {
        id: clientId,
        socket: ws,
        metadata: { deviceId }
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
        // Clean up terminal associations
        for (const [termId, cId] of this.termClientMap.entries()) {
          if (cId === clientId) {
            this.termClientMap.delete(termId);
          }
        }
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
      this.handleTerminalMessage(clientId, message);
      return;
    }
    
    if (message.type?.startsWith('agent:')) {
      this.handleAgentMessage(clientId, message);
      return;
    }
    
    if (message.type?.startsWith('fs:')) {
      this.handleFileSystemMessage(clientId, message);
      return;
    }

    logger.warn('WebSocket', 'Unhandled message type', { type: message.type, clientId });
  }

  /**
   * Handle terminal messages
   * @param {string} clientId
   * @param {WebSocketMessage} message
   */
  handleTerminalMessage(clientId, message) {
    const { type, payload } = message;
    const ws = this.clients.get(clientId)?.socket;
    if (!ws) return;

    switch (type) {
      case 'term:attach': {
        const { id } = payload || {};
        if (typeof id === 'string') {
          this.termClientMap.set(id, clientId);
          this.sendBacklogToClient(clientId, id);
          
          const opened = {
            v: 1,
            id: crypto.randomUUID(),
            sessionId: clientId,
            ts: new Date().toISOString(),
            type: 'term:attached',
            payload: { id },
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify(opened));
        }
        break;
      }

      case 'term:open': {
        const { id, cwd, rows, cols } = payload || {};
        this.termClientMap.set(id, clientId);
        this.backlogMap.set(id, { chunks: [], totalBytes: 0 });
        this.lastInputSeqByTerm.delete(id);
        
        const opened = {
          v: 1,
          id: crypto.randomUUID(),
          sessionId: clientId,
          ts: new Date().toISOString(),
          type: 'term:opened',
          payload: { id, cols: cols || 80, rows: rows || 24 },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(opened));
        break;
      }

      case 'term:input': {
        const { id, data, seq } = payload || {};
        
        // Dedupe by seq if provided
        if (typeof id === 'string' && Number.isFinite(seq)) {
          const last = this.lastInputSeqByTerm.get(id) ?? -1;
          if (Number(seq) <= last) {
            logger.websocket('term_input_dropped_seq', clientId, { id, seq, last });
            break;
          }
          this.lastInputSeqByTerm.set(id, Number(seq));
        }
        
        // For now, just echo back the input (terminal manager would handle this)
        logger.websocket('term_input', clientId, { id, dataLength: data?.length });
        break;
      }

      case 'term:resize': {
        const { id, cols, rows, seq } = payload || {};
        if (typeof id === 'string' && Number.isFinite(cols) && Number.isFinite(rows)) {
          const resized = {
            v: 1,
            id: crypto.randomUUID(),
            sessionId: clientId,
            ts: new Date().toISOString(),
            type: 'term:resized',
            payload: { id, cols: Number(cols), rows: Number(rows), seq },
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify(resized));
        }
        break;
      }

      case 'term:close': {
        const { id } = payload || {};
        if (typeof id === 'string') {
          this.termClientMap.delete(id);
          this.backlogMap.delete(id);
          this.lastInputSeqByTerm.delete(id);
        }
        break;
      }

      default:
        logger.warn('Terminal', `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle agent messages
   * @param {string} clientId
   * @param {WebSocketMessage} message
   */
  handleAgentMessage(clientId, message) {
    const { type, payload } = message;
    logger.websocket('agent_message', clientId, { type });
    
    // For now, just acknowledge the message
    // In a full implementation, this would route to the agent service
    switch (type) {
      case 'agent:start':
      case 'agent:stop':
      case 'agent:message':
        logger.debug('Agent message received', type);
        break;
      default:
        logger.warn('Agent', `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle file system messages
   * @param {string} clientId
   * @param {WebSocketMessage} message
   */
  handleFileSystemMessage(clientId, message) {
    const { type, payload } = message;
    logger.websocket('fs_message', clientId, { type });
    
    // File system operations are typically handled via HTTP API
    // WebSocket messages would be for real-time notifications
    switch (type) {
      case 'fs:watch':
      case 'fs:unwatch':
        logger.debug('File system message received', type);
        break;
      default:
        logger.warn('FileSystem', `Unknown message type: ${type}`);
    }
  }

  /**
   * Flush terminal frame buffer
   * @param {string} id - Terminal ID
   */
  flushFrame(id) {
    const buf = this.frameBuffers.get(id);
    if (!buf || buf.chunks.length === 0) return;

    if (buf.timer) {
      clearTimeout(buf.timer);
      buf.timer = null;
    }

    const data = buf.chunks.join('');
    buf.chunks = [];
    buf.bytes = 0;
    const owner = this.termClientMap.get(id);
    if (!owner || data.length === 0) return;

    /** @type {TerminalFramePayload} */
    const payload = { id, seq: ++buf.seq, ts: Date.now(), data };
    /** @type {WebSocketMessage} */
    const message = {
      v: 1,
      id: crypto.randomUUID(),
      sessionId: 'system',
      ts: new Date().toISOString(),
      type: 'term:frame',
      payload,
      timestamp: Date.now(),
    };
    this.send(owner, message);
  }

  /**
   * Append data to terminal backlog
   * @param {string} id - Terminal ID
   * @param {string} data - Terminal data
   */
  appendBacklog(id, data) {
    if (!data) return;
    let entry = this.backlogMap.get(id);
    if (!entry) {
      entry = { chunks: [], totalBytes: 0 };
      this.backlogMap.set(id, entry);
    }
    entry.chunks.push(data);
    entry.totalBytes += data.length;
    while (entry.totalBytes > this.MAX_BACKLOG_BYTES && entry.chunks.length > 0) {
      const removed = entry.chunks.shift();
      if (!removed) break;
      entry.totalBytes -= removed.length;
    }
  }

  /**
   * Get joined backlog for terminal
   * @param {string} id - Terminal ID
   * @returns {string | null}
   */
  getBacklogJoined(id) {
    const entry = this.backlogMap.get(id);
    if (!entry || entry.chunks.length === 0) return null;
    return entry.chunks.join('');
  }

  /**
   * Send backlog to client
   * @param {string} clientId
   * @param {string} id - Terminal ID
   */
  sendBacklogToClient(clientId, id) {
    const joined = this.getBacklogJoined(id);
    if (!joined) return;
    let offset = 0;
    while (offset < joined.length) {
      const end = Math.min(offset + this.MAX_FRAME_BYTES, joined.length);
      const slice = joined.slice(offset, end);
      /** @type {TerminalFramePayload} */
      const payload = { id, seq: 0, ts: Date.now(), data: slice };
      /** @type {WebSocketMessage} */
      const message = {
        v: 1,
        id: crypto.randomUUID(),
        sessionId: 'system',
        ts: new Date().toISOString(),
        type: 'term:frame',
        payload,
        timestamp: Date.now(),
      };
      this.send(clientId, message);
      offset = end;
    }
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
   * Send binary data to specific client
   * @param {string} clientId
   * @param {Buffer | Uint8Array} data
   */
  sendBinary(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== 1) {
      return false;
    }

    try {
      client.socket.send(data);
      return true;
    } catch (error) {
      logger.error('WebSocket', 'Binary send failed', { clientId, error: error.message });
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
    // Clear all timers
    for (const buf of this.frameBuffers.values()) {
      if (buf.timer) {
        clearTimeout(buf.timer);
      }
    }
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.termClientMap.clear();
    this.frameBuffers.clear();
    this.backlogMap.clear();
    this.lastInputSeqByTerm.clear();
    logger.info('WebSocket', 'Server closed');
  }
}

export const wsManager = new WebSocketManager();