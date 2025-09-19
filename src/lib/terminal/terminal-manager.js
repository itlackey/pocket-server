/**
 * Terminal PTY Manager
 * Handles PTY operations without parsing
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { logger } from '../shared/logger.js';

/**
 * @typedef {import('./types.js').TerminalSession} TerminalSession
 * @typedef {import('./types.js').TerminalFrame} TerminalFrame
 * @typedef {import('./types.js').TerminalExit} TerminalExit
 */

/**
 * @typedef {TerminalSession & { pty: pty.IPty }} PTYSession
 */

export class TerminalManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, PTYSession>} */
    this.sessions = new Map();
  }
  
  /**
   * Open a new terminal session
   * @param {string} id - Session ID
   * @param {string} cwd - Working directory
   * @param {number} rows - Terminal rows
   * @param {number} cols - Terminal columns
   * @returns {TerminalSession}
   */
  open(id, cwd, rows = 24, cols = 80) {
    if (this.sessions.has(id)) {
      this.close(id);
    }
    
    const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash');
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      },
    });
    
    ptyProcess.onData((data) => {
      this.emit('data', { id, data });
    });
    
    ptyProcess.onExit(({ exitCode, signal }) => {
      const code = exitCode || (signal ? 128 : 0);
      this.emit('exit', { id, code });
      this.sessions.delete(id);
      logger.terminal('session_closed', id, { code });
    });
    
    /** @type {PTYSession} */
    const session = {
      id,
      cwd,
      cols,
      rows,
      createdAt: Date.now(),
      pty: ptyProcess,
    };
    
    this.sessions.set(id, session);
    logger.terminal('session_opened', id, { cwd, cols, rows });
    
    return { id, cwd, cols, rows, createdAt: session.createdAt };
  }
  
  /**
   * Write data to terminal
   * @param {string} id - Session ID
   * @param {string} data - Data to write
   */
  write(id, data) {
    const session = this.sessions.get(id);
    if (!session) {
      logger.terminal('write_failed', id, { error: 'Session not found' });
      return;
    }
    session.pty.write(data);
    logger.terminal('write', id, { length: data.length });
  }
  
  /**
   * Resize terminal
   * @param {string} id - Session ID
   * @param {number} cols - Terminal columns
   * @param {number} rows - Terminal rows
   */
  resize(id, cols, rows) {
    const session = this.sessions.get(id);
    if (!session) {
      logger.terminal('resize_failed', id, { error: 'Session not found' });
      return;
    }
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    logger.terminal('resized', id, { cols, rows });
  }
  
  /**
   * Close terminal session
   * @param {string} id - Session ID
   */
  close(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    
    try {
      session.pty.kill();
    } catch (error) {
      logger.terminal('close_error', id, { error });
    } finally {
      this.sessions.delete(id);
      logger.terminal('session_closed', id);
    }
  }
  
  /**
   * Get a terminal session
   * @param {string} id - Session ID
   * @returns {TerminalSession | undefined}
   */
  get(id) {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    return { 
      id: session.id, 
      cwd: session.cwd, 
      cols: session.cols, 
      rows: session.rows, 
      createdAt: session.createdAt 
    };
  }
  
  /**
   * Get all active sessions
   * @returns {string[]}
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }
  
  /**
   * Get session count
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }
}