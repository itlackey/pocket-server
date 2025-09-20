/**
 * Anthropic Service for SvelteKit
 * Converted from TypeScript with comprehensive JSDoc types
 * 
 * Main service for managing Claude agent sessions and conversations
 * 
 * @fileoverview Core Anthropic Claude integration with streaming, tools, and conversation management
 */

import Anthropic from '@anthropic-ai/sdk';
import { generateSystemPrompt } from './prompt.js';
import { processStream } from './streaming.js';
import { logger } from '$lib/shared/logger.js';
import { bashToolDefinition, executeBash } from './tools/bash.js';
import { editorToolDefinition, executeEditor } from './tools/editor.js';
import { webSearchToolDefinition, executeWebSearch } from './tools/web-search.js';
import { workPlanToolDefinition, executeWorkPlan } from './tools/work-plan.js';
import { loadProjectContext } from '../context/loader.js';
import { generateConversationTitle } from '../core/title.js';

/**
 * @typedef {Object} ConversationMessage
 * @property {'user' | 'assistant'} role - Message role
 * @property {string | Array<any>} content - Message content (text or blocks)
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id - Conversation ID
 * @property {string} title - Conversation title
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {ConversationMessage[]} messages - Conversation messages
 * @property {Object} metadata - Conversation metadata
 * @property {string} metadata.model - AI model used
 * @property {number} metadata.totalTokens - Total tokens used
 * @property {Object} settings - Conversation settings
 * @property {number} settings.maxTokens - Maximum tokens per response
 * @property {Array<any>} settings.tools - Available tools
 */

/**
 * @typedef {Object} StreamingState
 * @property {any} currentMessage - Current streaming message
 * @property {Array<any>} contentBlocks - Content blocks being streamed
 * @property {number|null} activeBlockIndex - Index of active content block
 * @property {string} activeBlockContent - Content of active block
 * @property {boolean} isStreaming - Whether currently streaming
 * @property {string|null} error - Error message if any
 * @property {boolean} [aborted] - Whether stream was aborted
 * @property {Array<any>} [autoToolRequests] - Auto-approved tool requests
 */

/**
 * @typedef {Object} ProjectContext
 * @property {string} source - Context source
 * @property {string} path - Context file path
 * @property {string} content - Context content
 */

/**
 * @typedef {Object} ToolRequest
 * @property {string} id - Tool request ID
 * @property {string} name - Tool name
 * @property {any} input - Tool input parameters
 * @property {string} description - Tool description
 * @property {boolean} [approved] - Whether tool was approved
 */

/**
 * @typedef {Object} AgentSession
 * @property {string} id - Session ID
 * @property {Conversation} conversation - Conversation data
 * @property {StreamingState} streamingState - Current streaming state
 * @property {string} workingDir - Working directory
 * @property {boolean} maxMode - Whether in max mode (auto-approve tools)
 * @property {Date} createdAt - Session creation time
 * @property {Date} lastActivity - Last activity timestamp
 * @property {'created'|'starting'|'ready'|'streaming'|'awaiting_tool'|'error'|'stopped'} phase - Current phase
 * @property {ToolRequest[]} pendingTools - Pending tool requests
 * @property {ProjectContext} [projectContext] - Project context
 * @property {AbortController} [currentStreamController] - Current stream controller
 */

/**
 * @typedef {Object} ClientMessage
 * @property {string} type - Message type
 * @property {string} sessionId - Session ID
 * @property {string} [content] - Message content
 * @property {string} [workingDir] - Working directory
 * @property {boolean} [maxMode] - Max mode setting
 * @property {boolean} [chatMode] - Chat mode setting
 * @property {Object} [toolResponse] - Tool response
 * @property {string} toolResponse.id - Tool ID
 * @property {boolean} toolResponse.approved - Whether approved
 */

/**
 * @typedef {Object} ServerMessage
 * @property {string} type - Message type
 * @property {string} sessionId - Session ID
 * @property {string} [content] - Message content
 * @property {string} [error] - Error message
 * @property {string} [title] - Conversation title
 * @property {'created'|'starting'|'ready'|'streaming'|'awaiting_tool'|'error'|'stopped'} [phase] - Current phase
 * @property {ToolRequest} [toolRequest] - Tool request
 * @property {any} [message] - Full message object
 * @property {any} [toolOutput] - Tool output
 * @property {boolean} [isComplete] - Whether message is complete
 */

/**
 * @typedef {Object} ToolResultBlock
 * @property {'tool_result'} type - Block type
 * @property {string} tool_use_id - Tool use ID
 * @property {string} content - Result content
 * @property {boolean} is_error - Whether result is an error
 */

export class AnthropicService {
  constructor() {
    /** @type {Anthropic|null} */
    this.anthropic = null;
    
    /** @type {Map<string, AgentSession>} */
    this.sessions = new Map();
    
    /** @type {NodeJS.Timeout|null} */
    this.cleanupInterval = null;
    
    // Start cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this.cleanupSessions(), 60000);
  }

  /**
   * Initialize Anthropic client with API key
   * @param {string} apiKey - Anthropic API key
   * @returns {Anthropic} Anthropic client instance
   */
  initClient(apiKey) {
    if (!this.anthropic || this.anthropic.apiKey !== apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  /**
   * Create or get session
   * @param {string} sessionId - Session ID
   * @param {string} workingDir - Working directory
   * @returns {AgentSession} Session object
   */
  getOrCreateSession(sessionId, workingDir) {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      const now = new Date();
      session = {
        id: sessionId,
        conversation: {
          id: sessionId,
          title: 'New Chat',
          createdAt: now,
          updatedAt: now,
          messages: [],
          metadata: {
            model: 'claude-sonnet-4-20250514',
            totalTokens: 0
          },
          settings: {
            maxTokens: 4096,
            tools: [bashToolDefinition, editorToolDefinition, webSearchToolDefinition, workPlanToolDefinition]
          }
        },
        streamingState: {
          currentMessage: null,
          contentBlocks: [],
          activeBlockIndex: null,
          activeBlockContent: '',
          isStreaming: false,
          error: null
        },
        workingDir,
        maxMode: false, // Default to chat mode (require approval)
        createdAt: now,
        lastActivity: now,
        phase: 'created',
        pendingTools: []
      };
      this.sessions.set(sessionId, session);
    }
    
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Process a user message
   * @param {ClientMessage} message - Client message
   * @param {string} apiKey - Anthropic API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   * @returns {Promise<void>}
   */
  async processMessage(message, apiKey, onMessage) {
    const { sessionId, content, workingDir = process.cwd(), maxMode = false } = message;
    
    if (!content) {
      onMessage({
        type: 'agent:error',
        sessionId,
        error: 'No message content provided'
      });
      return;
    }

    const session = this.getOrCreateSession(sessionId, workingDir);
    // Reflect latest request settings on the session
    session.maxMode = maxMode;
    session.workingDir = workingDir;
    session.phase = 'starting';
    
    onMessage({ 
      type: 'agent:status', 
      sessionId, 
      phase: 'starting' 
    });
    
    // Generate title for first message and persist
    if (session.conversation.messages.length === 0) {
      const title = await generateConversationTitle(content, apiKey);
      session.conversation.title = title;
      try {
        const { sessionStoreFs } = await import('../store/session-store-fs.js');
        await sessionStoreFs.updateTitle(sessionId, title);
      } catch {}
      onMessage({ type: 'agent:title', sessionId, title });
    }

    // Add user message to conversation
    session.conversation.messages.push({
      role: 'user',
      content
    });
    session.conversation.updatedAt = new Date();
    
    try {
      const { sessionStoreFs } = await import('../store/session-store-fs.js');
      await sessionStoreFs.recordUserMessage(sessionId, content, { workingDir, maxMode });
    } catch {}
    
    session.phase = 'ready';
    onMessage({ type: 'agent:status', sessionId, phase: 'ready' });

    // Resolve project context once on first user message
    if (session.conversation.messages.length === 1 && !session.projectContext) {
      try {
        const ctx = await loadProjectContext(workingDir);
        if (ctx) {
          session.projectContext = { source: ctx.source, path: ctx.path, content: ctx.content };
        }
      } catch {}
    }

    // Create system prompt
    const systemPrompt = this.generateSystemPrompt({
      workingDirectory: workingDir,
      projectContext: session.projectContext
        ? { sourcePath: session.projectContext.path, content: session.projectContext.content }
        : undefined,
    });

    try {
      // Store reference to current stream for potential cancellation
      if (session.currentStreamController) {
        session.currentStreamController.abort();
      }
      session.currentStreamController = new AbortController();

      const anthropic = this.initClient(apiKey);

      logger.debug('AnthropicService', `Starting conversation for session: ${sessionId}`, {
        hasTools: session.conversation.settings.tools.length > 0,
        maxMode: session.maxMode
      });

      // Create stream config
      const streamConfig = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: session.conversation.messages,
        tools: session.conversation.settings.tools
      };

      // Process stream using the original pattern
      const streamingState = await processStream(
        sessionId,
        workingDir,
        maxMode,
        !maxMode, // chatMode = !maxMode
        onMessage,
        async (request) => {
          // Send tool request to client
          onMessage({
            type: 'agent:tool_request',
            sessionId,
            content: `Tool request: ${request.description}`,
            toolRequest: request
          });
          // Track pending tool for snapshot/status
          session.pendingTools = [...(session.pendingTools || []), request];
          session.phase = 'awaiting_tool';
        },
        async (toolId, output, isError) => {
          // Process tool result by adding to conversation and continuing
          await this.addToolResultToConversation(session, toolId, output, isError, apiKey, onMessage);
        },
        anthropic,
        streamConfig,
        (state) => {
          session.streamingState = state;
          session.lastActivity = new Date();
          session.phase = state.isStreaming ? 'streaming' : (state.error ? 'error' : 'ready');
        }
      );

      // Update session
      session.streamingState = streamingState;

      // Session updated by processStream callbacks
      session.lastActivity = new Date();

    } catch (error) {
      if (error.name === 'AbortError') {
        onMessage({
          type: 'agent:assistant',
          sessionId,
          content: session.streamingState.activeBlockContent || '',
          isComplete: true
        });
      } else {
        console.error(`[AnthropicService] Error processing message:`, error);
        session.phase = 'error';
        onMessage({
          type: 'agent:error',
          sessionId,
          error: error.message
        });
      }
    } finally {
      session.currentStreamController = undefined;
    }
  }

  /**
   * Generate system prompt
   * @param {string} workingDir - Working directory
   * @param {ProjectContext} [projectContext] - Project context
   * @returns {string} System prompt
   */
  generateSystemPrompt(params) {
    // Use the imported prompt generator with fallback to simple prompt
    try {
      return generateSystemPrompt(params);
    } catch (e) {
      // Fallback to simple prompt if the imported function fails
      const workingDir = params.workingDirectory || params.workingDir;
      const projectContext = params.projectContext;

      let prompt = `You are Claude, an AI assistant created by Anthropic. You are helpful, harmless, and honest.

Current working directory: ${workingDir}`;

      if (projectContext) {
        prompt += `\n\nProject context from ${projectContext.sourcePath || projectContext.path}:\n${projectContext.content.slice(0, 2000)}`;
      }

      return prompt;
    }
  }



  /**
   * Add tool result to conversation and continue
   * @param {AgentSession} session - Session
   * @param {string} toolId - Tool ID
   * @param {string} output - Tool output
   * @param {boolean} isError - Whether output is an error
   * @param {string} apiKey - API key
   * @param {function} onMessage - Message callback
   */
  async addToolResultToConversation(session, toolId, output, isError, apiKey, onMessage) {
    // Add tool result to conversation
    const toolResultBlock = {
      type: 'tool_result',
      tool_use_id: toolId,
      content: output,
      is_error: isError
    };

    session.conversation.messages.push({
      role: 'user',
      content: [toolResultBlock]
    });
    session.conversation.updatedAt = new Date();

    // Continue the conversation with the tool result
    return this.processMessage(
      {
        type: 'agent:continue',
        sessionId: session.id,
        workingDir: session.workingDir,
        maxMode: session.maxMode
      },
      apiKey,
      onMessage
    );
  }

  /**
   * Process tool response from client
   * @param {ClientMessage} message - Client message with tool response
   * @param {string} apiKey - Anthropic API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   * @returns {Promise<void>}
   */
  async processToolResponse(message, apiKey, onMessage) {
    const { sessionId, toolResponse } = message;
    const session = this.sessions.get(sessionId);

    if (!session) {
      onMessage({
        type: 'agent:error',
        sessionId,
        error: 'Session not found'
      });
      return;
    }

    if (!toolResponse || !toolResponse.id) {
      onMessage({
        type: 'agent:error',
        sessionId,
        error: 'Invalid tool response'
      });
      return;
    }

    // Find the pending tool request
    const toolRequestIndex = session.pendingTools.findIndex(t => t.id === toolResponse.id);

    if (toolRequestIndex === -1) {
      onMessage({
        type: 'agent:error',
        sessionId,
        error: 'Tool request not found'
      });
      return;
    }

    const toolRequest = session.pendingTools[toolRequestIndex];
    session.pendingTools.splice(toolRequestIndex, 1);

    if (!toolResponse.approved) {
      // Tool was rejected
      onMessage({
        type: 'agent:tool_rejected',
        sessionId,
        toolRequest
      });

      // Add rejection to conversation
      session.conversation.messages.push({
        role: 'user',
        content: `Tool use rejected: ${toolRequest.name}`
      });

      // Continue conversation
      return this.processMessage(
        {
          type: 'agent:continue',
          sessionId,
          content: `The ${toolRequest.name} tool use was not approved. Please continue without it.`,
          workingDir: session.workingDir,
          maxMode: session.maxMode
        },
        apiKey,
        onMessage
      );
    }

    // Execute the approved tool
    try {
      const result = await toolRegistry.execute(
        sessionId,
        toolRequest.name,
        toolRequest.input,
        session.workingDir
      );

      onMessage({
        type: 'agent:tool_output',
        sessionId,
        toolOutput: {
          id: toolRequest.id,
          name: toolRequest.name,
          output: result.success ? result.result : `Error: ${result.error}`
        }
      });

      // Add tool result to conversation
      const toolResultBlock = {
        type: 'tool_result',
        tool_use_id: toolRequest.id,
        content: result.success ? String(result.result) : `Error: ${result.error}`,
        is_error: !result.success
      };

      // Continue the conversation with the tool result
      session.conversation.messages.push({
        role: 'user',
        content: [toolResultBlock]
      });

      // Continue streaming with the tool result
      return this.processMessage(
        {
          type: 'agent:continue',
          sessionId,
          workingDir: session.workingDir,
          maxMode: session.maxMode
        },
        apiKey,
        onMessage
      );

    } catch (error) {
      logger.error('AnthropicService', 'Tool execution failed', {
        error: error.message,
        tool: toolRequest.name
      });

      onMessage({
        type: 'agent:error',
        sessionId,
        error: `Tool execution failed: ${error.message}`
      });
    }
  }

  /**
   * Stop streaming for a session
   * @param {string} sessionId - Session ID
   */
  stopStream(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session?.currentStreamController) {
      session.currentStreamController.abort();
      session.currentStreamController = undefined;
      session.pendingTools = [];
      session.phase = 'stopped';
      session.streamingState.isStreaming = false;
    }
  }

  /**
   * Get session
   * @param {string} sessionId - Session ID
   * @returns {AgentSession|undefined} Session object
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * List sessions (lightweight meta)
   * @returns {Array<Object>} Session list
   */
  listSessions() {
    const result = [];
    for (const s of this.sessions.values()) {
      result.push({
        id: s.id,
        title: s.conversation.title,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        messageCount: s.conversation.messages.length,
        workingDir: s.workingDir,
        maxMode: s.maxMode,
        phase: s.phase || 'ready'
      });
    }
    return result;
  }

  /**
   * Get snapshot for a session
   * @param {string} sessionId - Session ID
   * @returns {Object|undefined} Session snapshot
   */
  getSnapshot(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    
    return {
      id: s.id,
      title: s.conversation.title,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      messageCount: s.conversation.messages.length,
      workingDir: s.workingDir,
      maxMode: s.maxMode,
      phase: s.phase || 'ready',
      pendingTools: s.pendingTools || [],
      conversation: { messages: s.conversation.messages },
      streamingState: s.streamingState,
    };
  }

  /**
   * Clear session
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.currentStreamController) {
        session.currentStreamController.abort();
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Cleanup old sessions (runs every minute)
   */
  cleanupSessions() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [sessionId, session] of this.sessions) {
      const lastActivity = session.lastActivity.getTime();
      if (now - lastActivity > oneHour) {
        console.log(`[AnthropicService] Cleaning up inactive session: ${sessionId}`);
        this.clearSession(sessionId);
      }
    }
  }

  /**
   * Dispose service
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all sessions
    for (const sessionId of this.sessions.keys()) {
      this.clearSession(sessionId);
    }
  }
}

// Export singleton instance
export const anthropicService = new AnthropicService();