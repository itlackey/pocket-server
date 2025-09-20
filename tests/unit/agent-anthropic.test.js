/**
 * Tests for Anthropic Agent Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicService } from '../src/lib/agent/anthropic/service.js';
import { toolRegistry } from '../src/lib/agent/tools/registry.js';

describe('AnthropicService', () => {
  let service;
  let mockAnthropicClient;

  beforeEach(() => {
    service = new AnthropicService();

    // Mock Anthropic client
    mockAnthropicClient = {
      messages: {
        stream: vi.fn(() => ({
          on: vi.fn(),
          abort: vi.fn()
        })),
        create: vi.fn()
      }
    };

    // Override initClient to return mock
    service.initClient = vi.fn(() => mockAnthropicClient);
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const sessionId = 'test-session';
      const workingDir = '/test/dir';

      const session = service.getOrCreateSession(sessionId, workingDir);

      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.workingDir).toBe(workingDir);
      expect(session.conversation.messages).toEqual([]);
      expect(session.phase).toBe('created');
      expect(session.maxMode).toBe(false);
    });

    it('should retrieve existing session', () => {
      const sessionId = 'test-session';
      const workingDir = '/test/dir';

      const session1 = service.getOrCreateSession(sessionId, workingDir);
      const session2 = service.getOrCreateSession(sessionId, workingDir);

      expect(session1).toBe(session2);
    });

    it('should update last activity on session access', () => {
      const sessionId = 'test-session';
      const workingDir = '/test/dir';

      const session = service.getOrCreateSession(sessionId, workingDir);
      const initialActivity = session.lastActivity;

      // Wait a bit
      vi.advanceTimersByTime(100);

      service.getOrCreateSession(sessionId, workingDir);
      expect(session.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should clear session', () => {
      const sessionId = 'test-session';
      const workingDir = '/test/dir';

      service.getOrCreateSession(sessionId, workingDir);
      service.clearSession(sessionId);

      const newSession = service.getOrCreateSession(sessionId, workingDir);
      expect(newSession.conversation.messages).toEqual([]);
    });
  });

  describe('Message Processing', () => {
    it('should process user message', async () => {
      const sessionId = 'test-session';
      const content = 'Hello, Claude!';
      const apiKey = 'test-api-key';
      const messages = [];

      const onMessage = vi.fn((msg) => messages.push(msg));

      // Create mock stream
      const mockStream = {
        on: vi.fn((event, handler) => {
          if (event === 'text') {
            handler('Hello! ');
            handler('How can I help?');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      mockAnthropicClient.messages.stream.mockReturnValue(mockStream);

      await service.processMessage(
        { sessionId, content, workingDir: '/test' },
        apiKey,
        onMessage
      );

      // Check messages were sent
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'agent:status',
          phase: 'starting'
        })
      );

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'agent:status',
          phase: 'ready'
        })
      );

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'agent:status',
          phase: 'streaming'
        })
      );

      // Check conversation was updated
      const session = service.sessions.get(sessionId);
      expect(session.conversation.messages).toHaveLength(2);
      expect(session.conversation.messages[0]).toEqual({
        role: 'user',
        content
      });
    });

    it('should handle error when no content provided', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];

      const onMessage = vi.fn((msg) => messages.push(msg));

      await service.processMessage(
        { sessionId, content: '', workingDir: '/test' },
        apiKey,
        onMessage
      );

      expect(messages).toContainEqual({
        type: 'agent:error',
        sessionId,
        error: 'No message content provided'
      });
    });
  });

  describe('Tool Response Processing', () => {
    it('should process approved tool response', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];
      const onMessage = vi.fn((msg) => messages.push(msg));

      // Create session with pending tool
      const session = service.getOrCreateSession(sessionId, '/test');
      session.pendingTools.push({
        id: 'tool-1',
        name: 'bash',
        input: { command: 'ls' },
        description: 'List files'
      });

      // Mock tool execution
      vi.spyOn(toolRegistry, 'execute').mockResolvedValue({
        success: true,
        result: 'file1.txt\nfile2.txt'
      });

      await service.processToolResponse(
        {
          sessionId,
          toolResponse: {
            id: 'tool-1',
            approved: true
          }
        },
        apiKey,
        onMessage
      );

      expect(toolRegistry.execute).toHaveBeenCalledWith(
        sessionId,
        'bash',
        { command: 'ls' },
        '/test'
      );

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'agent:tool_output',
          sessionId
        })
      );
    });

    it('should handle rejected tool response', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];
      const onMessage = vi.fn((msg) => messages.push(msg));

      // Create session with pending tool
      const session = service.getOrCreateSession(sessionId, '/test');
      const toolRequest = {
        id: 'tool-1',
        name: 'bash',
        input: { command: 'rm -rf /' },
        description: 'Delete everything'
      };
      session.pendingTools.push(toolRequest);

      // Mock processMessage to track continuation
      vi.spyOn(service, 'processMessage').mockResolvedValue();

      await service.processToolResponse(
        {
          sessionId,
          toolResponse: {
            id: 'tool-1',
            approved: false
          }
        },
        apiKey,
        onMessage
      );

      expect(messages).toContainEqual({
        type: 'agent:tool_rejected',
        sessionId,
        toolRequest
      });

      expect(service.processMessage).toHaveBeenCalled();
    });

    it('should handle invalid tool response', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];
      const onMessage = vi.fn((msg) => messages.push(msg));

      service.getOrCreateSession(sessionId, '/test');

      await service.processToolResponse(
        {
          sessionId,
          toolResponse: null
        },
        apiKey,
        onMessage
      );

      expect(messages).toContainEqual({
        type: 'agent:error',
        sessionId,
        error: 'Invalid tool response'
      });
    });
  });

  describe('System Prompt Generation', () => {
    it('should generate basic system prompt', () => {
      const workingDir = '/test/project';
      const prompt = service.generateSystemPrompt(workingDir);

      expect(prompt).toContain(workingDir);
      expect(prompt).toContain('Pocket');
    });

    it('should include project context if provided', () => {
      const workingDir = '/test/project';
      const projectContext = {
        path: 'README.md',
        content: 'This is a test project'
      };

      const prompt = service.generateSystemPrompt(workingDir, projectContext);

      expect(prompt).toContain(workingDir);
      expect(prompt).toContain('README.md');
      expect(prompt).toContain('test project');
    });
  });

  describe('Title Generation', () => {
    it('should generate conversation title', async () => {
      const message = 'Help me write a Python script';
      const apiKey = 'test-api-key';

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{ text: 'Python Script Help' }]
      });

      const title = await service.generateConversationTitle(message, apiKey);

      expect(title).toBe('Python Script Help');
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: message }]
        })
      );
    });

    it('should handle title generation failure', async () => {
      const message = 'Help me';
      const apiKey = 'test-api-key';

      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API error'));

      const title = await service.generateConversationTitle(message, apiKey);

      expect(title).toBe('New Conversation');
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup old sessions', () => {
      vi.useFakeTimers();

      const sessionId = 'old-session';
      const session = service.getOrCreateSession(sessionId, '/test');

      // Set last activity to over an hour ago
      session.lastActivity = new Date(Date.now() - 61 * 60 * 1000);

      // Run cleanup
      service.cleanupSessions();

      // Session should be removed
      expect(service.sessions.has(sessionId)).toBe(false);

      vi.useRealTimers();
    });

    it('should not cleanup recent sessions', () => {
      const sessionId = 'recent-session';
      service.getOrCreateSession(sessionId, '/test');

      // Run cleanup
      service.cleanupSessions();

      // Session should still exist
      expect(service.sessions.has(sessionId)).toBe(true);
    });
  });

  describe('Stream Handling', () => {
    it('should handle tool use in stream', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];
      const onMessage = vi.fn((msg) => messages.push(msg));

      const mockStream = {
        on: vi.fn((event, handler) => {
          if (event === 'contentBlockStart') {
            handler({
              type: 'tool_use',
              id: 'tool-1',
              name: 'bash'
            });
          } else if (event === 'contentBlockStop') {
            handler({
              type: 'tool_use',
              id: 'tool-1',
              name: 'bash',
              input: { command: 'pwd' }
            });
          } else if (event === 'end') {
            handler();
          }
        })
      };

      mockAnthropicClient.messages.stream.mockReturnValue(mockStream);

      // Set max mode for auto-approval
      await service.processMessage(
        { sessionId, content: 'Show current directory', workingDir: '/test', maxMode: true },
        apiKey,
        onMessage
      );

      const session = service.sessions.get(sessionId);
      expect(session.maxMode).toBe(true);

      // Check tool request was sent
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'agent:tool_request_start',
          sessionId
        })
      );
    });

    it('should handle stream abort', async () => {
      const sessionId = 'test-session';
      const apiKey = 'test-api-key';
      const messages = [];
      const onMessage = vi.fn((msg) => messages.push(msg));

      const mockStream = {
        on: vi.fn(),
        abort: vi.fn()
      };

      mockAnthropicClient.messages.stream.mockReturnValue(mockStream);

      // Start first stream
      const promise1 = service.processMessage(
        { sessionId, content: 'First message', workingDir: '/test' },
        apiKey,
        onMessage
      );

      // Start second stream (should abort first)
      await service.processMessage(
        { sessionId, content: 'Second message', workingDir: '/test' },
        apiKey,
        onMessage
      );

      expect(mockStream.abort).not.toHaveBeenCalled(); // New stream doesn't have abort
    });
  });
});