/**
 * Terminal module types and utilities
 */

/**
 * @typedef {Object} TerminalSession
 * @property {string} id - Session ID
 * @property {string} cwd - Current working directory
 * @property {number} cols - Terminal columns
 * @property {number} rows - Terminal rows
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} TerminalInfo
 * @property {string} id - Session ID
 * @property {string} [title] - Session title
 * @property {string} cwd - Current working directory
 * @property {number} createdAt - Creation timestamp
 * @property {number} [cols] - Terminal columns
 * @property {number} [rows] - Terminal rows
 * @property {boolean} active - Whether session is active
 * @property {string} [ownerClientId] - Owner client ID
 * @property {string} [ownerDeviceId] - Owner device ID
 * @property {number} [lastAttachedAt] - Last attachment timestamp
 */

/**
 * @typedef {Object} TerminalFrame
 * @property {string} id - Session ID
 * @property {string} data - Terminal data
 */

/**
 * @typedef {Object} TerminalExit
 * @property {string} id - Session ID
 * @property {number} code - Exit code
 */