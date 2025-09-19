/**
 * Enhanced logger utility with terminal formatting
 */
import { colors, formatCategory, formatLogLevel } from './terminal-ui.js';

/**
 * @typedef {'DEBUG' | 'INFO' | 'WARN' | 'ERROR'} LogLevelName
 */

/** @enum {number} */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  /** @type {number} */
  #level = LogLevel.INFO;

  /**
   * Set the log level
   * @param {LogLevelName} level
   */
  setLevel(level) {
    this.#level = LogLevel[level];
  }

  /**
   * Internal log method
   * @param {number} level
   * @param {string} category
   * @param {string} message
   * @param {any} [data]
   */
  #log(level, category, message, data) {
    if (level < this.#level) return;
    const ts = new Date().toISOString();
    const timestamp = `${colors.gray}${ts}${colors.reset}`;
    const levelStr = formatLogLevel(Object.keys(LogLevel)[level]);
    const categoryStr = formatCategory(category);
    const messageStr = `${colors.bright}${message}${colors.reset}`;
    const dataStr = data ? ` ${colors.dim}${JSON.stringify(data)}${colors.reset}` : '';
    
    console.log(`${timestamp} ${levelStr} ${categoryStr} ${messageStr}${dataStr}`);
  }

  /**
   * Debug level logging
   * @param {string} category
   * @param {string} message
   * @param {any} [data]
   */
  debug(category, message, data) {
    this.#log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Info level logging
   * @param {string} category
   * @param {string} message
   * @param {any} [data]
   */
  info(category, message, data) {
    this.#log(LogLevel.INFO, category, message, data);
  }

  /**
   * Warning level logging
   * @param {string} category
   * @param {string} message
   * @param {any} [data]
   */
  warn(category, message, data) {
    this.#log(LogLevel.WARN, category, message, data);
  }

  /**
   * Error level logging
   * @param {string} category
   * @param {string} message
   * @param {any} [data]
   */
  error(category, message, data) {
    this.#log(LogLevel.ERROR, category, message, data);
  }

  /**
   * HTTP request logging
   * @param {string} method
   * @param {string} path
   * @param {number} status
   * @param {number} [duration]
   */
  http(method, path, status, duration) {
    const durationStr = duration ? ` (${duration}ms)` : '';
    this.info('HTTP', `${method} ${path} ${status}${durationStr}`);
  }

  /**
   * WebSocket event logging
   * @param {string} event
   * @param {string} clientId
   * @param {any} [data]
   */
  websocket(event, clientId, data) {
    this.info('WebSocket', `${event} - Client: ${clientId}`, data);
  }

  /**
   * Terminal event logging
   * @param {string} event
   * @param {string} sessionId
   * @param {any} [data]
   */
  terminal(event, sessionId, data) {
    this.info('Terminal', `${event} - Session: ${sessionId}`, data);
  }

  /**
   * Agent event logging
   * @param {string} event
   * @param {string} sessionId
   * @param {any} [data]
   */
  agent(event, sessionId, data) {
    this.info('Agent', `${event} - Session: ${sessionId}`, data);
  }
}

export const logger = new Logger();