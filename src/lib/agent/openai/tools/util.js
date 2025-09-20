/**
 * OpenAI Tools Utilities
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview Utility functions for OpenAI tools
 */

import { join, resolve, isAbsolute } from 'path';

/**
 * Resolve a path relative to working directory, preventing directory traversal
 * @param {string} workingDir - Working directory
 * @param {string} path - Path to resolve
 * @returns {string} Resolved absolute path
 */
export function resolvePath(workingDir, path) {
  if (isAbsolute(path)) {
    return resolve(path);
  }
  return resolve(join(workingDir, path));
}