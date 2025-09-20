/**
 * Core Orchestrator (v1)
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Minimal unification layer that delegates to provider adapters.
 * Future iterations can move full approval aggregation/state here.
 *
 * @fileoverview Core orchestrator for managing provider adapters
 */

/**
 * @typedef {import('./adapters.js').ProviderAdapter} ProviderAdapter
 */

/**
 * Core orchestrator that manages provider adapters
 */
export class Orchestrator {
  /**
   * @param {ProviderAdapter} adapter - Provider adapter
   * @param {string} apiKey - API key for the provider
   */
  constructor(adapter, apiKey) {
    /** @type {ProviderAdapter} */
    this.adapter = adapter;

    /** @type {string} */
    this.apiKey = apiKey;
  }

  /**
   * Handle a message by delegating to the provider adapter
   * @param {any} message - Message to handle
   * @param {function(any): void} onMessage - Message callback
   * @returns {Promise<void>}
   */
  async handle(message, onMessage) {
    await this.adapter.send(message, this.apiKey, onMessage);
  }
}