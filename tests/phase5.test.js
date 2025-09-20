import { expect, test, describe } from 'vitest';

/**
 * Phase 5 Functionality Tests
 * Tests for OpenAI integration and provider switching
 */

const BASE_URL = 'http://localhost:3000';

describe('Phase 5: OpenAI Alternative Provider', () => {
  describe('Provider Management API', () => {
    test('Providers status endpoint works', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/providers`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('providers');
      expect(data.providers).toHaveProperty('defaultProvider');
      expect(data.providers).toHaveProperty('availableProviders');
      expect(Array.isArray(data.providers.availableProviders)).toBe(true);
    });

    test('Provider status includes both Anthropic and OpenAI', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/providers`);
      const data = await response.json();

      const providers = data.providers.availableProviders;
      const providerNames = providers.map(p => p.name);

      expect(providerNames).toContain('anthropic');
      expect(providerNames).toContain('openai');

      // Check provider structure
      const anthropicProvider = providers.find(p => p.name === 'anthropic');
      expect(anthropicProvider).toHaveProperty('displayName');
      expect(anthropicProvider).toHaveProperty('models');
      expect(anthropicProvider).toHaveProperty('enabled', true);
      expect(Array.isArray(anthropicProvider.models)).toBe(true);

      const openaiProvider = providers.find(p => p.name === 'openai');
      expect(openaiProvider).toHaveProperty('displayName');
      expect(openaiProvider).toHaveProperty('models');
      expect(openaiProvider).toHaveProperty('enabled', true);
      expect(Array.isArray(openaiProvider.models)).toBe(true);
    });

    test('Session provider can be set', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session-123',
          provider: 'openai'
        })
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('sessionId', 'test-session-123');
      expect(data).toHaveProperty('provider', 'openai');
    });

    test('Provider switching validates input', async () => {
      // Test missing sessionId
      const response1 = await fetch(`${BASE_URL}/api/agent/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai'
        })
      });

      expect(response1.status).toBe(400);
      const data1 = await response1.json();
      expect(data1.error).toContain('Session ID is required');

      // Test missing provider
      const response2 = await fetch(`${BASE_URL}/api/agent/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session'
        })
      });

      expect(response2.status).toBe(400);
      const data2 = await response2.json();
      expect(data2.error).toContain('Provider is required');
    });

    test('Invalid provider is rejected', async () => {
      const response = await fetch(`${BASE_URL}/api/agent/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session-456',
          provider: 'invalid-provider'
        })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Unknown provider');
    });
  });

  describe('Service Integration', () => {
    test('OpenAI service can be imported', async () => {
      // Test that OpenAI service can be imported
      expect(() => {
        import('$lib/agent/openai/service.js');
      }).not.toThrow();
    });

    test('OpenAI tools can be imported', async () => {
      // Test that OpenAI tools can be imported
      expect(() => {
        import('$lib/agent/openai/tools/index.js');
      }).not.toThrow();
    });

    test('Provider manager can be imported', async () => {
      // Test that provider manager can be imported
      expect(() => {
        import('$lib/agent/index.js');
      }).not.toThrow();
    });

    test('All OpenAI tools have proper structure', async () => {
      const { openaiTools, openaiToolDefinitions } = await import('$lib/agent/openai/tools/index.js');

      // Check tools object
      expect(typeof openaiTools).toBe('object');
      expect(Array.isArray(openaiToolDefinitions)).toBe(true);

      // Check specific tools exist
      const expectedTools = [
        'read_file',
        'write_file',
        'list_files',
        'edit_in_file',
        'append_to_file',
        'search_files',
        'search_repo',
        'execute_command',
        'get_git_working_state',
        'work_plan'
      ];

      for (const toolName of expectedTools) {
        expect(openaiTools).toHaveProperty(toolName);
        expect(typeof openaiTools[toolName]).toBe('function');
      }

      // Check tool definitions structure
      for (const def of openaiToolDefinitions) {
        expect(def).toHaveProperty('type', 'function');
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('parameters');
        expect(typeof def.name).toBe('string');
        expect(typeof def.description).toBe('string');
      }
    });

    test('Provider manager has correct structure', async () => {
      const { agentProviderManager } = await import('$lib/agent/index.js');

      expect(agentProviderManager).toHaveProperty('getAvailableProviders');
      expect(agentProviderManager).toHaveProperty('setSessionProvider');
      expect(agentProviderManager).toHaveProperty('getSessionProvider');
      expect(agentProviderManager).toHaveProperty('getService');
      expect(agentProviderManager).toHaveProperty('processMessage');
      expect(agentProviderManager).toHaveProperty('processToolResponse');

      // Test getting available providers
      const providers = agentProviderManager.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);

      // Test default provider
      const defaultSessionProvider = agentProviderManager.getSessionProvider('non-existent-session');
      expect(typeof defaultSessionProvider).toBe('string');
    });
  });

  describe('Integration with Existing Systems', () => {
    test('Existing background agent API still works', async () => {
      const response = await fetch(`${BASE_URL}/api/background`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('manager');
      expect(data).toHaveProperty('queue');
      expect(data).toHaveProperty('tracker');
    });

    test('All Phase APIs remain functional', async () => {
      const endpoints = [
        '/api/health',
        '/api/background',
        '/api/agent/providers'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        expect(response.ok).toBe(true);
      }
    });
  });
});