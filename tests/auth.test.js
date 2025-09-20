/**
 * Tests for authentication middleware and token handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyAuthFromRequest, isLocalRequest } from '../src/lib/auth/middleware.js';
import { getOrCreateLocalWsSecret, getLocalWsSecretFast } from '../src/lib/auth/local-ws.js';
import { verifyAccessToken, generateAccessToken } from '../src/lib/auth/token.js';

// Mock file system operations
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

// Mock device registry
vi.mock('../src/lib/auth/device-registry.js', () => ({
  getDevice: vi.fn((deviceId) => {
    if (deviceId === 'valid-device') {
      return { id: 'valid-device', revoked: false };
    }
    if (deviceId === 'revoked-device') {
      return { id: 'revoked-device', revoked: true };
    }
    return null;
  }),
  updateLastSeen: vi.fn()
}));

describe('Authentication Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without authorization header', async () => {
    const req = new Request('http://localhost/', {});
    const result = await verifyAuthFromRequest(req);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.reason).toBe('missing_token');
  });

  it('should reject requests with invalid authorization format', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'Authorization': 'Bearer invalid' }
    });
    const result = await verifyAuthFromRequest(req);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.reason).toBe('missing_token');
  });

  it('should reject requests with invalid tokens', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'Authorization': 'Pocket invalid-token' }
    });
    const result = await verifyAuthFromRequest(req);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.reason).toBe('invalid_token');
  });

  it('should reject requests for revoked devices', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'Authorization': 'Pocket revoked-device-token123' }
    });
    const result = await verifyAuthFromRequest(req);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.reason).toBe('device_unregistered');
  });

  it('should accept valid tokens for active devices', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'Authorization': 'Pocket valid-device-token123' }
    });
    const result = await verifyAuthFromRequest(req);

    expect(result.ok).toBe(true);
    expect(result.deviceId).toBe('valid-device');
  });
});

describe('Local Request Detection', () => {
  it('should identify localhost requests as local', () => {
    const req = new Request('http://localhost:3000/');
    expect(isLocalRequest(req)).toBe(true);
  });

  it('should identify 127.0.0.1 requests as local', () => {
    const req = new Request('http://127.0.0.1:3000/');
    expect(isLocalRequest(req)).toBe(true);
  });

  it('should identify private network ranges as local', () => {
    expect(isLocalRequest(new Request('http://192.168.1.1/'))).toBe(true);
    expect(isLocalRequest(new Request('http://10.0.0.1/'))).toBe(true);
    expect(isLocalRequest(new Request('http://172.16.0.1/'))).toBe(true);
  });

  it('should identify public hosts as non-local', () => {
    expect(isLocalRequest(new Request('http://example.com/'))).toBe(false);
    expect(isLocalRequest(new Request('http://8.8.8.8/'))).toBe(false);
  });

  it('should respect public host override', () => {
    const req = new Request('http://myapp.example.com/');
    expect(isLocalRequest(req, 'myapp.example.com')).toBe(false);
  });
});

describe('Token Management', () => {
  it('should verify valid token format', async () => {
    const token = 'valid-device-abc123def456';
    const result = await verifyAccessToken(token);

    expect(result).not.toBeNull();
    expect(result.deviceId).toBe('valid-device');
  });

  it('should reject invalid token format', async () => {
    const token = 'invalid';
    const result = await verifyAccessToken(token);

    expect(result).toBeNull();
  });

  it('should generate valid tokens', () => {
    const deviceId = 'testdevice';
    const token = generateAccessToken(deviceId);

    expect(token).toContain(deviceId);
    expect(token.split('-')).toHaveLength(2);
    expect(token.length).toBeGreaterThan(deviceId.length + 16);
  });
});

describe('Local WebSocket Secret', () => {
  beforeEach(() => {
    delete globalThis.__POCKET_LOCAL_WS_SECRET;
    vi.clearAllMocks();
  });

  it('should return cached secret when available', () => {
    const testSecret = 'test-secret-123';
    globalThis.__POCKET_LOCAL_WS_SECRET = testSecret;
    
    const result = getLocalWsSecretFast();
    expect(result).toBe(testSecret);
  });

  it('should return null when no cached secret', () => {
    const result = getLocalWsSecretFast();
    expect(result).toBeNull();
  });

  it('should create secret if file does not exist', async () => {
    const fs = await import('fs');
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});

    const secret = getOrCreateLocalWsSecret();
    
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(20);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should read existing secret from file', async () => {
    const existingSecret = 'existing-secret-456';
    const fs = await import('fs');
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existingSecret);

    const secret = getOrCreateLocalWsSecret();
    
    expect(secret).toBe(existingSecret);
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(globalThis.__POCKET_LOCAL_WS_SECRET).toBe(existingSecret);
  });
});