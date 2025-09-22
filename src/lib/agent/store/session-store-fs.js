/**
 * SessionStoreFs
 * Simplified file-based session store converted to JavaScript with JSDoc
 */

import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { resolveDataPath } from '../../shared/paths.js';

/**
 * @typedef {import('../types.js').SessionIndexItem} SessionIndexItem
 * @typedef {import('../types.js').SessionSnapshot} SessionSnapshot
 * @typedef {import('../types.js').CreateSessionOptions} CreateSessionOptions
 */

/**
 * Ensure value is an array
 * @template T
 * @param {T[] | undefined} v - Value to check
 * @returns {T[]} Array value
 */
function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

class SessionStoreFs {
  constructor(baseDir) {
    const root = baseDir || resolve(resolveDataPath('sessions'));
    this.baseDir = root;
    this.indexPath = join(root, 'index.json');
    
    /** @type {Map<string, Promise<void>>} */
    this.writeQueues = new Map();
    
    /** @type {Map<string, number>} */
    this.lastSeq = new Map();
  }

  async init() {
    await this.ensureDir(this.baseDir);
    try {
      await fs.access(this.indexPath);
    } catch {
      await this.atomicWriteJson(this.indexPath, []);
    }
  }

  /**
   * Create a new session
   * @param {CreateSessionOptions} opts - Session options
   * @returns {Promise<string>} Session ID
   */
  async createSession(opts) {
    const id = opts.id || crypto.randomUUID();
    const dir = this.sessionDir(id);
    
    await this.enqueue(id, async () => {
      await this.ensureDir(dir);
      const now = new Date().toISOString();
      
      /** @type {SessionSnapshot} */
      const snap = {
        id,
        title: opts.title || 'New Chat',
        createdAt: now,
        lastActivity: now,
        messageCount: 0,
        workingDir: opts.workingDir || '',
        maxMode: !!opts.maxMode,
        phase: 'created',
        pendingTools: [],
        conversation: { messages: [] },
        streamingState: {
          currentMessage: null,
          contentBlocks: [],
          activeBlockIndex: null,
          activeBlockContent: '',
          isStreaming: false,
          error: null,
        },
        lastSeq: 0,
      };
      
      await this.writeSnapshot(id, snap);
      await this.upsertIndex({
        id,
        title: snap.title,
        createdAt: snap.createdAt,
        lastActivity: snap.lastActivity,
        messageCount: 0,
        workingDir: snap.workingDir,
        maxMode: snap.maxMode,
        phase: snap.phase,
      });
      
      this.lastSeq.set(id, 0);
    });
    
    return id;
  }

  /**
   * Update session title
   * @param {string} sessionId - Session ID
   * @param {string} newTitle - New title
   */
  async updateTitle(sessionId, newTitle) {
    await this.enqueue(sessionId, async () => {
      const snap = await this.readSnapshot(sessionId);
      if (!snap) return;
      
      snap.title = newTitle;
      snap.lastActivity = new Date().toISOString();
      
      await this.writeSnapshot(sessionId, snap);
      await this.upsertIndex({
        id: snap.id,
        title: snap.title,
        createdAt: snap.createdAt,
        lastActivity: snap.lastActivity,
        messageCount: snap.messageCount,
        workingDir: snap.workingDir,
        maxMode: snap.maxMode,
        phase: snap.phase,
      });
    });
  }

  /**
   * Get session snapshot
   * @param {string} sessionId - Session ID
   * @returns {Promise<SessionSnapshot | null>}
   */
  async getSnapshot(sessionId) {
    return this.readSnapshot(sessionId);
  }

  /**
   * List all sessions
   * @returns {Promise<SessionIndexItem[]>}
   */
  async listSessions() {
    try {
      const content = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(content) || [];
    } catch {
      return [];
    }
  }

  /**
   * Clear a session
   * @param {string} sessionId - Session ID
   */
  async clearSession(sessionId) {
    await this.enqueue(sessionId, async () => {
      const snap = await this.readSnapshot(sessionId);
      if (!snap) return;
      
      // Reset conversation but keep metadata
      snap.conversation = { messages: [] };
      snap.messageCount = 0;
      snap.lastActivity = new Date().toISOString();
      snap.phase = 'cleared';
      snap.pendingTools = [];
      snap.streamingState = {
        currentMessage: null,
        contentBlocks: [],
        activeBlockIndex: null,
        activeBlockContent: '',
        isStreaming: false,
        error: null,
      };
      
      await this.writeSnapshot(sessionId, snap);
      await this.upsertIndex({
        id: snap.id,
        title: snap.title,
        createdAt: snap.createdAt,
        lastActivity: snap.lastActivity,
        messageCount: 0,
        workingDir: snap.workingDir,
        maxMode: snap.maxMode,
        phase: snap.phase,
      });
    });
  }

  // --- Private methods ---

  /**
   * Get session directory path
   * @param {string} sessionId - Session ID
   * @returns {string}
   */
  sessionDir(sessionId) {
    return join(this.baseDir, sessionId);
  }

  /**
   * Enqueue operation for session
   * @param {string} sessionId - Session ID
   * @param {() => Promise<void>} operation - Operation to run
   */
  async enqueue(sessionId, operation) {
    const existing = this.writeQueues.get(sessionId);
    const promise = existing
      ? existing.then(operation).catch(() => operation())
      : operation();
    
    this.writeQueues.set(sessionId, promise);
    
    try {
      await promise;
    } finally {
      if (this.writeQueues.get(sessionId) === promise) {
        this.writeQueues.delete(sessionId);
      }
    }
  }

  /**
   * Ensure directory exists
   * @param {string} dir - Directory path
   */
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Write JSON atomically
   * @param {string} path - File path
   * @param {any} data - Data to write
   */
  async atomicWriteJson(path, data) {
    const tempPath = `${path}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, path);
  }

  /**
   * Write session snapshot
   * @param {string} sessionId - Session ID
   * @param {SessionSnapshot} snap - Snapshot data
   */
  async writeSnapshot(sessionId, snap) {
    const snapshotPath = join(this.sessionDir(sessionId), 'snapshot.json');
    await this.atomicWriteJson(snapshotPath, snap);
  }

  /**
   * Read session snapshot
   * @param {string} sessionId - Session ID
   * @returns {Promise<SessionSnapshot | null>}
   */
  async readSnapshot(sessionId) {
    try {
      const snapshotPath = join(this.sessionDir(sessionId), 'snapshot.json');
      const content = await fs.readFile(snapshotPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Update session index
   * @param {SessionIndexItem} item - Index item
   */
  async upsertIndex(item) {
    try {
      /** @type {SessionIndexItem[]} */
      let index = [];
      
      try {
        const content = await fs.readFile(this.indexPath, 'utf8');
        index = JSON.parse(content) || [];
      } catch {
        // File doesn't exist or is invalid, start with empty array
      }
      
      const existingIndex = index.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        index[existingIndex] = item;
      } else {
        index.push(item);
      }
      
      // Sort by last activity (most recent first)
      index.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
      
      await this.atomicWriteJson(this.indexPath, index);
    } catch (error) {
      console.error('Failed to update session index:', error);
    }
  }
}

// Export singleton instance
export const sessionStoreFs = new SessionStoreFs();