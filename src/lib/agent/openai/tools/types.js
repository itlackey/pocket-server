/**
 * OpenAI Tools Type Definitions
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview OpenAI tool type definitions
 */

/**
 * @template TInput
 * @template TOutput
 * @typedef {function(TInput, {workingDir: string, sessionId?: string}): Promise<TOutput>} ToolHandler
 */

/**
 * @typedef {Object} ToolContext
 * @property {string} workingDir - Working directory
 * @property {string} [sessionId] - Session ID
 */

export {}; // Make this a module