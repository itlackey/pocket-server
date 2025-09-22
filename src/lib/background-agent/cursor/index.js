/**
 * Cursor Background Agent Integration
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Main export point for Cursor integration
 *
 * @fileoverview Cursor integration exports and setup
 */

import { verifyAuthFromRequest } from '$lib/auth/middleware.js';

/**
 * @typedef {import('./types.js').StructuredDiff} StructuredDiff
 * @typedef {import('./types.js').CursorAgentMinimal} CursorAgentMinimal
 * @typedef {import('./types.js').CursorConversationMessage} CursorConversationMessage
 */

/**
 * Register background agent cursor routes with authentication
 * @param {Object} router - Router instance (SvelteKit doesn't use this pattern)
 */
export function registerBackgroundAgentCursor(router) {
  // In SvelteKit, routes are file-based, so this is mainly for compatibility
  // The actual route protection happens in hooks.server.js or individual route files
  console.log('Cursor background agent integration registered');
}

// Re-export types for external use
export * from './types.js';
export * from './client.js';
export * from './github.js';
export * from './tracker.js';
export * from './store.js';