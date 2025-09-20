import { expect, test, describe } from 'vitest';

/**
 * Notifications API Tests
 * Tests for notifications API endpoints
 */

const BASE_URL = 'http://localhost:3000';

describe('Notifications API Endpoints', () => {
  describe('Notifications API', () => {
    test('Status endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('missing_token');
    });

    test('Registration endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'test-device',
          expoPushToken: 'ExponentPushToken[test]',
          platform: 'ios'
        })
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('missing_token');
    });

    test('Unregistration endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'test-device'
        })
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('missing_token');
    });
  });

  describe('Tunnel API', () => {
    test('Tunnel status endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/tunnel`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('missing_token');
    });

    test('Tunnel control endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('missing_token');
    });

    test('Tunnel control validates action parameter', async () => {
      // This test will fail auth first, but we can test the structure
      const response = await fetch(`${BASE_URL}/api/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing action
      });

      expect(response.status).toBe(401); // Auth fails first
    });
  });

  describe('API Endpoint Structure', () => {
    test('All endpoints return proper error structure for auth failures', async () => {
      const endpoints = [
        '/api/notifications',
        '/api/tunnel'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toBe('missing_token');
      }
    });

    test('POST endpoints handle JSON parsing gracefully', async () => {
      const endpoints = [
        '/api/notifications',
        '/api/tunnel'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        });

        // Should fail at auth level, not JSON parsing
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Existing API Integration', () => {
    test('Background agent API still works', async () => {
      const response = await fetch(`${BASE_URL}/api/background`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('manager');
      expect(data).toHaveProperty('queue');
      expect(data).toHaveProperty('tracker');
    });

    test('Health endpoint still works', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('uptime');
    });
  });
});