/**
 * Tests for WebSocket functionality and terminal integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wsManager } from '../src/lib/websocket.js';
import { TerminalManager } from '../src/lib/terminal/terminal-manager.js';
import { TerminalRegistry } from '../src/lib/terminal/registry.js';

// Mock node-pty to avoid requiring actual PTY in tests
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn()
  }))
}));

describe('WebSocket Manager', () => {
  beforeEach(() => {
    // Reset WebSocket manager state
    wsManager.clients.clear();
    wsManager.termClientMap.clear();
    wsManager.frameBuffers.clear();
    wsManager.backlogMap.clear();
    wsManager.lastInputSeqByTerm.clear();
  });

  it('should handle client connections', () => {
    const mockWs = {
      readyState: 1,
      send: vi.fn()
    };
    
    const clientId = 'test-client-1';
    wsManager.clients.set(clientId, {
      id: clientId,
      socket: mockWs,
      metadata: {}
    });

    expect(wsManager.getClientCount()).toBe(1);
    expect(wsManager.getClient(clientId)).toBeDefined();
  });

  it('should send messages to clients', () => {
    const mockWs = {
      readyState: 1,
      send: vi.fn()
    };
    
    const clientId = 'test-client-1';
    wsManager.clients.set(clientId, {
      id: clientId,
      socket: mockWs,
      metadata: {}
    });

    const message = {
      v: 1,
      id: 'msg-1',
      sessionId: 'session-1',
      ts: new Date().toISOString(),
      type: 'test:message',
      payload: { data: 'test' },
      timestamp: Date.now()
    };

    const result = wsManager.send(clientId, message);
    expect(result).toBe(true);
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('should handle ping/pong messages', () => {
    const mockWs = {
      readyState: 1,
      send: vi.fn()
    };
    
    const clientId = 'test-client-1';
    wsManager.clients.set(clientId, {
      id: clientId,
      socket: mockWs,
      metadata: {}
    });

    const pingMessage = {
      v: 1,
      id: 'ping-1',
      sessionId: 'session-1',
      ts: new Date().toISOString(),
      type: 'ping',
      payload: {},
      timestamp: Date.now()
    };

    wsManager.handleMessage(clientId, pingMessage);

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"pong"')
    );
  });

  it('should handle terminal messages', () => {
    const mockWs = {
      readyState: 1,
      send: vi.fn()
    };
    
    const clientId = 'test-client-1';
    wsManager.clients.set(clientId, {
      id: clientId,
      socket: mockWs,
      metadata: {}
    });

    const termMessage = {
      v: 1,
      id: 'term-1',
      sessionId: 'session-1',
      ts: new Date().toISOString(),
      type: 'term:open',
      payload: { id: 'terminal-1', cwd: '/tmp', rows: 24, cols: 80 },
      timestamp: Date.now()
    };

    wsManager.handleMessage(clientId, termMessage);

    expect(wsManager.termClientMap.get('terminal-1')).toBe(clientId);
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"term:opened"')
    );
  });

  it('should manage terminal backlog', () => {
    const termId = 'test-terminal';
    const data = 'test terminal output';

    wsManager.appendBacklog(termId, data);
    const backlog = wsManager.getBacklogJoined(termId);

    expect(backlog).toBe(data);
  });

  it('should broadcast messages to all clients', () => {
    const mockWs1 = { readyState: 1, send: vi.fn() };
    const mockWs2 = { readyState: 1, send: vi.fn() };
    
    wsManager.clients.set('client-1', { id: 'client-1', socket: mockWs1, metadata: {} });
    wsManager.clients.set('client-2', { id: 'client-2', socket: mockWs2, metadata: {} });

    const message = {
      v: 1,
      id: 'broadcast-1',
      sessionId: 'system',
      ts: new Date().toISOString(),
      type: 'broadcast:test',
      payload: { data: 'broadcast test' },
      timestamp: Date.now()
    };

    const sent = wsManager.broadcast(message);
    expect(sent).toBe(2);
    expect(mockWs1.send).toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalled();
  });
});

describe('Terminal Manager', () => {
  let terminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    // Clean up any open sessions
    const sessions = terminalManager.getActiveSessions();
    sessions.forEach(id => terminalManager.close(id));
  });

  it('should create terminal sessions', () => {
    const sessionId = 'test-session';
    const cwd = '/tmp';
    const rows = 24;
    const cols = 80;

    const session = terminalManager.open(sessionId, cwd, rows, cols);

    expect(session.id).toBe(sessionId);
    expect(session.cwd).toBe(cwd);
    expect(session.rows).toBe(rows);
    expect(session.cols).toBe(cols);
    expect(terminalManager.getSessionCount()).toBe(1);
  });

  it('should write to terminal sessions', () => {
    const sessionId = 'test-session';
    terminalManager.open(sessionId, '/tmp', 24, 80);

    // Should not throw
    expect(() => {
      terminalManager.write(sessionId, 'test command\n');
    }).not.toThrow();
  });

  it('should resize terminal sessions', () => {
    const sessionId = 'test-session';
    terminalManager.open(sessionId, '/tmp', 24, 80);

    terminalManager.resize(sessionId, 100, 30);

    const session = terminalManager.get(sessionId);
    expect(session.cols).toBe(100);
    expect(session.rows).toBe(30);
  });

  it('should close terminal sessions', () => {
    const sessionId = 'test-session';
    terminalManager.open(sessionId, '/tmp', 24, 80);

    expect(terminalManager.getSessionCount()).toBe(1);

    terminalManager.close(sessionId);

    expect(terminalManager.getSessionCount()).toBe(0);
    expect(terminalManager.get(sessionId)).toBeUndefined();
  });

  it('should handle write to non-existent session', () => {
    // Should not throw
    expect(() => {
      terminalManager.write('non-existent', 'test');
    }).not.toThrow();
  });
});

describe('Terminal Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new TerminalRegistry();
  });

  it('should upsert terminal entries', () => {
    const entry = {
      id: 'test-terminal',
      title: 'Test Terminal',
      cwd: '/tmp',
      cols: 80,
      rows: 24,
      active: true
    };

    registry.upsert(entry);

    const retrieved = registry.get('test-terminal');
    expect(retrieved.id).toBe(entry.id);
    expect(retrieved.title).toBe(entry.title);
    expect(retrieved.cwd).toBe(entry.cwd);
  });

  it('should update existing entries', () => {
    const entry = {
      id: 'test-terminal',
      title: 'Test Terminal',
      cwd: '/tmp'
    };

    registry.upsert(entry);
    registry.upsert({ id: 'test-terminal', title: 'Updated Terminal' });

    const retrieved = registry.get('test-terminal');
    expect(retrieved.title).toBe('Updated Terminal');
    expect(retrieved.cwd).toBe('/tmp'); // Should preserve existing values
  });

  it('should set terminal titles', () => {
    registry.upsert({ id: 'test-terminal', title: 'Original' });
    registry.setTitle('test-terminal', 'New Title');

    const retrieved = registry.get('test-terminal');
    expect(retrieved.title).toBe('New Title');
  });

  it('should list all entries', () => {
    registry.upsert({ id: 'terminal-1', title: 'Terminal 1' });
    registry.upsert({ id: 'terminal-2', title: 'Terminal 2' });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map(e => e.id)).toContain('terminal-1');
    expect(list.map(e => e.id)).toContain('terminal-2');
  });

  it('should remove entries', () => {
    registry.upsert({ id: 'test-terminal', title: 'Test' });
    expect(registry.get('test-terminal')).toBeDefined();

    registry.remove('test-terminal');
    expect(registry.get('test-terminal')).toBeUndefined();
  });

  it('should clear all entries', () => {
    registry.upsert({ id: 'terminal-1' });
    registry.upsert({ id: 'terminal-2' });
    expect(registry.list()).toHaveLength(2);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});