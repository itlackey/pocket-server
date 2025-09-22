/**
 * Provider Adapters
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Defines interfaces and types for provider adapters
 *
 * @fileoverview Provider adapter interface definitions
 */

/**
 * @typedef {Object} TurnResult
 * @property {Array<{id: string, name: string, input: any, description?: string, responseId?: string}>} [toolRequests] - Tool requests from turn
 * @property {any[]} [finalBlocks] - Final content blocks
 * @property {string} [responseId] - Response identifier
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {function(any, string, function(any): void): Promise<void>} send - Send message to provider
 */