/**
 * Anthropic Service for SvelteKit
 * Converted from TypeScript with comprehensive JSDoc types
 * 
 * Main service for managing Claude agent sessions and conversations
 * 
 * @fileoverview Core Anthropic Claude integration with streaming, tools, and conversation management
 */

import Anthropic from '@anthropic-ai/sdk';

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
            tools: [] // Will be populated with tool definitions
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
    
    // Generate title for first message
    if (session.conversation.messages.length === 0) {
      try {
        const title = await this.generateConversationTitle(content, apiKey);
        session.conversation.title = title;
        
        // Try to persist title using session store
        try {
          const { sessionStoreFs } = await import('../store/session-store-fs.js');
          await sessionStoreFs.updateTitle(sessionId, title);
        } catch (e) {
          console.warn('Could not persist title:', e.message);
        }
        
        onMessage({ 
          type: 'agent:title', 
          sessionId, 
          title 
        });
      } catch (e) {
        console.warn('Could not generate title:', e.message);
      }
    }

    // Add user message to conversation
    session.conversation.messages.push({
      role: 'user',
      content
    });
    session.conversation.updatedAt = new Date();
    
    // Try to persist user message
    try {
      const { sessionStoreFs } = await import('../store/session-store-fs.js');
      await sessionStoreFs.recordUserMessage(sessionId, content, { workingDir, maxMode });
    } catch (e) {
      console.warn('Could not persist user message:', e.message);
    }
    
    session.phase = 'ready';
    onMessage({ 
      type: 'agent:status', 
      sessionId, 
      phase: 'ready' 
    });

    // Basic system prompt (simplified for now)
    const systemPrompt = this.generateSystemPrompt(workingDir, session.projectContext);

    try {
      // Store reference to current stream for potential cancellation
      if (session.currentStreamController) {
        session.currentStreamController.abort();
      }
      session.currentStreamController = new AbortController();

      const anthropic = this.initClient(apiKey);
      
      // Basic conversation without tools for now
      console.log(`[AnthropicService] Starting conversation for session: ${sessionId}`);
      
      session.phase = 'streaming';
      onMessage({ 
        type: 'agent:status', 
        sessionId, 
        phase: 'streaming' 
      });

      // Start streaming
      session.streamingState.isStreaming = true;
      session.streamingState.contentBlocks = [];
      session.streamingState.activeBlockContent = '';

      const stream = anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: session.conversation.messages
      });

      let assistantContent = '';

      stream.on('text', (text) => {
        assistantContent += text;
        session.streamingState.activeBlockContent = assistantContent;
        
        onMessage({
          type: 'agent:assistant',
          sessionId,
          content: text,
          isComplete: false
        });
      });

      stream.on('end', () => {
        session.streamingState.isStreaming = false;
        session.streamingState.contentBlocks = [{ type: 'text', text: assistantContent }];
        session.phase = 'ready';
        
        // Add assistant message to conversation
        session.conversation.messages.push({
          role: 'assistant',
          content: assistantContent
        });
        session.conversation.updatedAt = new Date();
        
        onMessage({
          type: 'agent:assistant',
          sessionId,
          content: '',
          isComplete: true
        });
        
        onMessage({ 
          type: 'agent:status', 
          sessionId, 
          phase: 'ready' 
        });
      });

      stream.on('error', (error) => {
        console.error(`[AnthropicService] Stream error:`, error);
        session.streamingState.isStreaming = false;
        session.streamingState.error = error.message;
        session.phase = 'error';
        
        onMessage({
          type: 'agent:error',
          sessionId,
          error: error.message
        });
      });

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
  generateSystemPrompt(workingDir, projectContext) {
    let prompt = `You are Claude, an AI assistant created by Anthropic. You are helpful, harmless, and honest.

Current working directory: ${workingDir}`;

    if (projectContext) {
      prompt += `\n\nProject context from ${projectContext.path}:\n${projectContext.content.slice(0, 2000)}`;
    }

    return prompt;
  }

  /**
   * Generate conversation title
   * @param {string} message - First message
   * @param {string} apiKey - Anthropic API key
   * @returns {Promise<string>} Generated title
   */
  async generateConversationTitle(message, apiKey) {
    try {
      const anthropic = this.initClient(apiKey);
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
        system: 'Generate a short, descriptive title (max 5 words) for this conversation based on the user\'s first message. Respond with only the title, no quotes or extra text.',
        messages: [{ role: 'user', content: message }]
      });

      const title = response.content[0]?.text?.trim() || 'New Conversation';
      return title.length > 50 ? title.slice(0, 47) + '...' : title;
    } catch (error) {
      console.warn('Could not generate title:', error.message);
      return 'New Conversation';
    }
  }

  /**
   * Process tool response from client (placeholder)
   * @param {ClientMessage} message - Client message with tool response
   * @param {string} apiKey - Anthropic API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   * @returns {Promise<void>}
   */
  async processToolResponse(message, apiKey, onMessage) {
    // TODO: Implement tool response processing
    const { sessionId } = message;
    onMessage({
      type: 'agent:error',
      sessionId,
      error: 'Tool response processing not yet implemented'
    });
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