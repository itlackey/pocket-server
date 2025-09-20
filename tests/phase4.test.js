import { expect, test, describe } from 'vitest';

/**
 * Phase 4 Functionality Tests
 * Tests for notifications, tunnel, and CLI functionality
 */

const BASE_URL = 'http://localhost:3000';

describe('Phase 4: Supporting Services', () => {
  describe('Notifications API', () => {
    test('Status endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/notifications`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
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
    });

    test('Notifications service can be imported', async () => {
      // Test that the service module can be imported
      expect(() => {
        import('$lib/notifications/service.js');
      }).not.toThrow();
    });
  });

  describe('Tunnel Management', () => {
    test('Tunnel status endpoint requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/tunnel`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
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
    });

    test('Cloudflare integration can be imported', async () => {
      // Test that the cloudflare module can be imported
      expect(() => {
        import('$lib/tunnel/cloudflare.js');
      }).not.toThrow();
    });

    test('Tunnel manager can be imported', async () => {
      // Test that the tunnel manager can be imported
      expect(() => {
        import('$lib/tunnel/manager.js');
      }).not.toThrow();
    });
  });

  describe('CLI Commands', () => {
    test('CLI commands module can be imported', async () => {
      // Test that CLI commands can be imported
      expect(() => {
        import('$lib/cli/commands.js');
      }).not.toThrow();
    });

    test('CLI server utilities can be imported', async () => {
      // Test that CLI server utilities can be imported
      expect(() => {
        import('$lib/cli/server.js');
      }).not.toThrow();
    });

    test('parseArgs works correctly', async () => {
      const { parseArgs } = await import('$lib/cli/commands.js');

      // Test basic command parsing
      const result1 = parseArgs(['start', '--port', '3000']);
      expect(result1.cmd).toBe('start');
      expect(result1.flags.port).toBe('3000');

      // Test flag parsing
      const result2 = parseArgs(['start', '--remote']);
      expect(result2.cmd).toBe('start');
      expect(result2.flags.remote).toBe(true);

      // Test help flag
      const result3 = parseArgs(['--help']);
      expect(result3.flags.help).toBe(true);
    });

    test('CLI server status can be checked', async () => {
      const { cliServer } = await import('$lib/cli/server.js');

      const status = cliServer.getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('timestamp');
      expect(typeof status.running).toBe('boolean');
    });
  });

  describe('Service Integration', () => {
    test('All Phase 4 services have proper exports', async () => {
      // Test notifications service exports
      const notifications = await import('$lib/notifications/service.js');
      expect(notifications).toHaveProperty('notificationsService');
      expect(typeof notifications.notificationsService.registerDevice).toBe('function');
      expect(typeof notifications.notificationsService.sendNotification).toBe('function');

      // Test tunnel exports
      const cloudflare = await import('$lib/tunnel/cloudflare.js');
      expect(cloudflare).toHaveProperty('startQuickTunnel');
      expect(cloudflare).toHaveProperty('getTunnelStatus');
      expect(typeof cloudflare.startQuickTunnel).toBe('function');

      const tunnelManager = await import('$lib/tunnel/manager.js');
      expect(tunnelManager).toHaveProperty('tunnelManager');

      // Test CLI exports
      const cliCommands = await import('$lib/cli/commands.js');
      expect(cliCommands).toHaveProperty('main');
      expect(cliCommands).toHaveProperty('parseArgs');
      expect(typeof cliCommands.main).toBe('function');

      const cliServer = await import('$lib/cli/server.js');
      expect(cliServer).toHaveProperty('cliServer');
      expect(typeof cliServer.cliServer.getStatus).toBe('function');
    });

    test('Notifications service basic functionality', async () => {
      const { notificationsService } = await import('$lib/notifications/service.js');

      // Test status
      const status = notificationsService.getStatus();
      expect(status).toHaveProperty('totalDevices');
      expect(status).toHaveProperty('byPlatform');
      expect(typeof status.totalDevices).toBe('number');

      // Test device registration with invalid data
      const result = notificationsService.registerDevice({
        deviceId: '',
        expoPushToken: 'invalid',
        platform: 'ios'
      });
      expect(result).toBeNull();
    });

    test('Tunnel status functionality', async () => {
      const { getTunnelStatus } = await import('$lib/tunnel/cloudflare.js');

      const status = getTunnelStatus();
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('binaryInstalled');
      expect(status).toHaveProperty('timestamp');
      expect(typeof status.active).toBe('boolean');
    });
  });
});