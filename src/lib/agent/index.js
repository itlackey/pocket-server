/**
 * Agent Provider Registry
 * Multi-provider agent system supporting Anthropic and OpenAI
 *
 * @fileoverview Main agent provider registry with switching capability
 */

import { anthropicService } from './anthropic/service.js';
import { openAIService } from './openai/service.js';
import { logger } from '$lib/shared/logger.js';

/**
 * @typedef {'anthropic' | 'openai'} ProviderType
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} name - Provider name
 * @property {string} displayName - Display name
 * @property {Object} service - Service implementation
 * @property {string[]} models - Supported models
 * @property {boolean} enabled - Whether provider is enabled
 */

/**
 * Available agent providers
 * @type {Record<ProviderType, ProviderConfig>}
 */
const providers = {
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    service: anthropicService,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    enabled: true,
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI GPT',
    service: openAIService,
    models: ['gpt-5', 'gpt-4', 'gpt-4-turbo'],
    enabled: true,
  },
};

/**
 * Agent Provider Manager
 */
class AgentProviderManager {
  constructor() {
    /** @type {ProviderType} */
    this.defaultProvider = 'anthropic';

    /** @type {Map<string, ProviderType>} */
    this.sessionProviders = new Map();
  }

  /**
   * Get available providers
   * @returns {ProviderConfig[]} Available providers
   */
  getAvailableProviders() {
    return Object.values(providers).filter(p => p.enabled);
  }

  /**
   * Get provider configuration
   * @param {ProviderType} providerName - Provider name
   * @returns {ProviderConfig | null} Provider config
   */
  getProvider(providerName) {
    return providers[providerName] || null;
  }

  /**
   * Set session provider
   * @param {string} sessionId - Session ID
   * @param {ProviderType} providerName - Provider name
   */
  setSessionProvider(sessionId, providerName) {
    if (!providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    this.sessionProviders.set(sessionId, providerName);
    logger.info('AgentProvider', 'session_provider_set', { sessionId, provider: providerName });
  }

  /**
   * Get session provider
   * @param {string} sessionId - Session ID
   * @returns {ProviderType} Provider name
   */
  getSessionProvider(sessionId) {
    return this.sessionProviders.get(sessionId) || this.defaultProvider;
  }

  /**
   * Get service for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Provider service
   */
  getService(sessionId) {
    const providerName = this.getSessionProvider(sessionId);
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    return provider.service;
  }

  /**
   * Process message with appropriate provider
   * @param {Object} message - Message data
   * @param {string} apiKey - API key
   * @param {function(any): void} onMessage - Message callback
   */
  async processMessage(message, apiKey, onMessage) {
    const { sessionId } = message;
    const service = this.getService(sessionId);
    const providerName = this.getSessionProvider(sessionId);

    logger.agent('agent:message_routed', sessionId, { provider: providerName });

    return service.processMessage(message, apiKey, onMessage);
  }

  /**
   * Process tool response with appropriate provider
   * @param {Object} message - Message data
   * @param {string} apiKey - API key
   * @param {function(any): void} onMessage - Message callback
   */
  async processToolResponse(message, apiKey, onMessage) {
    const { sessionId } = message;
    const service = this.getService(sessionId);
    const providerName = this.getSessionProvider(sessionId);

    logger.agent('agent:tool_response_routed', sessionId, { provider: providerName });

    return service.processToolResponse(message, apiKey, onMessage);
  }

  /**
   * Stop stream for session
   * @param {string} sessionId - Session ID
   */
  stopStream(sessionId) {
    const service = this.getService(sessionId);
    return service.stopStream(sessionId);
  }

  /**
   * Clear session
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    const service = this.getService(sessionId);
    this.sessionProviders.delete(sessionId);
    return service.clearSession(sessionId);
  }

  /**
   * Get provider status
   * @returns {Object} Provider status
   */
  getStatus() {
    return {
      defaultProvider: this.defaultProvider,
      availableProviders: this.getAvailableProviders().map(p => ({
        name: p.name,
        displayName: p.displayName,
        models: p.models,
        enabled: p.enabled,
      })),
      activeSessions: this.sessionProviders.size,
      sessionProviders: Object.fromEntries(this.sessionProviders),
    };
  }
}

// Export singleton instance
export const agentProviderManager = new AgentProviderManager();

// Legacy exports for backward compatibility
export { anthropicService } from './anthropic/service.js';
export { openAIService } from './openai/service.js';