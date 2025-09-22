/**
 * OpenAI (GPT-5) Service
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Manages sessions, streams, tools, and approvals for the OpenAI provider
 *
 * @fileoverview OpenAI service implementation with streaming and tool support
 */

import OpenAI from 'openai';
import { logger } from '$lib/shared/logger.js';
import { loadProjectContext } from '$lib/agent/context/loader.js';
import { generateConversationTitle } from '$lib/agent/core/title.js';
import { sessionStoreFs } from '$lib/agent/store/session-store-fs.js';
import { processOpenAIStream } from './streaming.js';
import { openaiTools } from './tools/index.js';

/**
 * @typedef {Object} OpenAISessionState
 * @property {string} id - Session ID
 * @property {string} workingDir - Working directory
 * @property {boolean} maxMode - Max mode enabled
 * @property {string|null} [previousResponseId] - Previous response ID
 * @property {Date} lastActivity - Last activity timestamp
 * @property {string} title - Session title
 * @property {boolean} [titleGenerated] - Whether title was generated
 * @property {Record<string, PendingTool>} pendingTools - Pending tool executions
 * @property {Object} [projectContext] - Project context
 * @property {'AGENTS.md'|'CLAUDE.md'} [projectContext.source] - Context source
 * @property {string} [projectContext.path] - Context file path
 * @property {string} [projectContext.content] - Context content
 */

/**
 * @typedef {Object} PendingTool
 * @property {string} name - Tool name
 * @property {any} input - Tool input
 * @property {string} [responseId] - Response ID
 * @property {boolean} [approved] - Whether approved
 * @property {string} [output] - Tool output
 * @property {boolean} [isError] - Whether output is an error
 */

/**
 * @typedef {Object} ToolRequest
 * @property {string} id - Tool request ID
 * @property {string} name - Tool name
 * @property {string} [providerName] - Provider-specific tool name
 * @property {any} input - Tool input
 * @property {string} [responseId] - Response ID
 */

/**
 * @typedef {Object} ServerMessage
 * @property {string} type - Message type
 * @property {string} sessionId - Session ID
 * @property {any} [content] - Message content
 * @property {string} [error] - Error message
 * @property {string} [title] - Title
 * @property {string} [phase] - Phase
 * @property {any} [message] - Message object
 * @property {any} [toolOutput] - Tool output
 * @property {any} [toolRequest] - Tool request
 */

/**
 * OpenAI Service Implementation
 */
class OpenAIServiceImpl {
  constructor() {
    /** @type {OpenAI | null} */
    this.client = null;

    /** @type {Map<string, OpenAISessionState>} */
    this.sessions = new Map();

    /** @type {Map<string, boolean>} */
    this.abortFlags = new Map();

    /** @type {Map<string, AbortController | undefined>} */
    this.streamControllers = new Map();
  }

  /**
   * Map provider tool names+inputs to canonical UI types used by the mobile app
   * @param {string} providerName - Provider tool name
   * @param {any} input - Tool input
   * @returns {{uiName: string, uiInput: any}} Mapped UI tool
   */
  mapUiForTool(providerName, input) {
    switch (providerName) {
      case 'execute_command':
        return { uiName: 'bash', uiInput: { command: input?.command } };
      case 'edit_in_file': {
        return {
          uiName: 'str_replace_based_edit_tool',
          uiInput: {
            command: 'str_replace',
            path: input?.path,
            old_str: input?.old,
            new_str: input?.new,
            replace_all: !!input?.replace_all
          }
        };
      }
      case 'append_to_file':
        return {
          uiName: 'str_replace_based_edit_tool',
          uiInput: { command: 'str_replace', path: input?.path, old_str: '', new_str: input?.text }
        };
      case 'read_file':
        return { uiName: 'str_replace_based_edit_tool', uiInput: { command: 'view', path: input?.path } };
      case 'write_file':
        return { uiName: 'str_replace_based_edit_tool', uiInput: { command: 'create', path: input?.path } };
      case 'list_files':
      case 'search_files':
        return {
          uiName: 'str_replace_based_edit_tool',
          uiInput: { command: 'view', path: input?.path, query: input?.query }
        };
      case 'search_repo':
        return { uiName: 'repo_search', uiInput: { query: input?.query, path: input?.path || '' } };
      case 'work_plan':
        return { uiName: 'work_plan', uiInput: input };
      default:
        return { uiName: providerName, uiInput: input };
    }
  }

  /**
   * Format raw tool outputs into the mobile-friendly text that existing components expect
   * @param {string} providerName - Provider tool name
   * @param {any} raw - Raw tool output
   * @returns {string} Formatted output
   */
  formatOutputForUi(providerName, raw) {
    try {
      // read_file: unwrap to plain file content
      if (providerName === 'read_file') {
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object') {
          if (typeof raw.content === 'string') return raw.content;
          if (raw.value && typeof raw.value.content === 'string') return raw.value.content;
        }
        return typeof raw === 'undefined' ? '' : String(typeof raw === 'object' ? JSON.stringify(raw) : raw);
      }

      // list_files: format as simple directory listing with [d]/[f] prefixes
      if (providerName === 'list_files') {
        const nodes = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray(raw.nodes) ? raw.nodes : []);
        const sorted = [...nodes].sort((a, b) => {
          const ad = (a?.type === 'directory') ? 0 : 1;
          const bd = (b?.type === 'directory') ? 0 : 1;
          if (ad !== bd) return ad - bd;
          const an = (a?.name || '').toLowerCase();
          const bn = (b?.name || '').toLowerCase();
          return an.localeCompare(bn);
        });
        const lines = ['Directory contents:'];
        for (const n of sorted) {
          const isDir = (n?.type === 'directory');
          const name = n?.name || n?.path || '';
          const prefix = isDir ? '[d]' : '[f]';
          lines.push(`${prefix} ${name}`);
        }
        return lines.join('\n');
      }

      // search_files: present grep-like results
      if (providerName === 'search_files') {
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length === 0) return 'No results found';
        const lines = [`Search results (${arr.length}):`];
        for (const r of arr) {
          const prefix = r?.type === 'directory' ? '[d]' : '[f]';
          const name = r?.name || r?.path || '';
          lines.push(`${prefix} ${name}`);
        }
        return lines.join('\n');
      }

      // search_repo: return structured JSON as-is (stringify for transport)
      if (providerName === 'search_repo') {
        return typeof raw === 'string' ? raw : JSON.stringify(raw);
      }

      // Default: stringify objects; pass through strings
      if (typeof raw === 'string') return raw;
      return JSON.stringify(raw);
    } catch (e) {
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
    }
  }

  /**
   * Initialize OpenAI client
   * @param {string} apiKey - OpenAI API key
   * @returns {OpenAI} OpenAI client
   */
  initClient(apiKey) {
    if (!this.client || this.client._apiKey !== apiKey) {
      const c = new OpenAI({ apiKey });
      c._apiKey = apiKey; // cache key for reuse
      this.client = c;
      logger.info('OpenAI', 'Initialized OpenAI client');
    }
    return this.client;
  }

  /**
   * Run auto-approve cycle for max mode
   * @param {string} sessionId - Session ID
   * @param {string} apiKey - API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   */
  async runAutoApproveCycle(sessionId, apiKey, onMessage) {
    const state = this.sessions.get(sessionId);
    if (!state || !state.maxMode) return;

    // Group pending tools by responseId (falling back to previousResponseId)
    const groups = {};
    for (const [id, p] of Object.entries(state.pendingTools)) {
      const rid = p.responseId || state.previousResponseId || 'unknown';
      if (!groups[rid]) groups[rid] = [];
      groups[rid].push(id);
    }

    for (const [rid, ids] of Object.entries(groups)) {
      if (!ids || ids.length === 0) continue;
      // Auto-approve all
      for (const id of ids) {
        const p = state.pendingTools[id];
        if (p) p.approved = true;
      }
      await this.executeAndContinueGroup(sessionId, rid, ids, apiKey, onMessage);
    }
  }

  /**
   * Execute and continue group of tools
   * @param {string} sessionId - Session ID
   * @param {string} responseIdForCall - Response ID
   * @param {string[]} ids - Tool IDs
   * @param {string} apiKey - API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   */
  async executeAndContinueGroup(sessionId, responseIdForCall, ids, apiKey, onMessage) {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    const outputs = [];
    for (const id of ids) {
      const pending = state.pendingTools[id];
      if (!pending) continue;

      if (pending.approved === true) {
        let toolOutputString = '';
        try {
          const fn = openaiTools[pending.name];
          if (typeof fn !== 'function') throw new Error(`Unknown tool: ${pending.name}`);
          const output = await fn(pending.input, { workingDir: state.workingDir, sessionId });
          toolOutputString = this.formatOutputForUi(pending.name, output);
          pending.output = toolOutputString;
          pending.isError = false;

          logger.agent('openai:tool_executed', sessionId, { id, name: pending.name, workingDir: state.workingDir });

          const mapped = this.mapUiForTool(pending.name, pending.input);
          // For append_to_file, suppress the status line in the UI by sending empty content
          const displayContent = pending.name === 'append_to_file' ? '' : toolOutputString;

          onMessage({
            type: 'agent:tool_output',
            sessionId,
            content: displayContent,
            message: {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              type: 'message',
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: id, content: displayContent, is_error: false }],
              model: '',
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 },
            },
            toolOutput: {
              id,
              tool_use_id: id,
              name: mapped.uiName,
              output: toolOutputString,
              isError: false,
              input: mapped.uiInput
            },
          });
        } catch (err) {
          toolOutputString = `Error: ${err.message}`;
          pending.output = toolOutputString;
          pending.isError = true;

          logger.error('OpenAI', 'Tool execution failed', { sessionId, id, name: pending.name, error: err.message });

          const mappedErr = this.mapUiForTool(pending.name, pending.input);
          onMessage({
            type: 'agent:tool_output',
            sessionId,
            content: toolOutputString,
            message: {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              type: 'message',
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: id, content: toolOutputString, is_error: true }],
              model: '',
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 },
            },
            toolOutput: {
              id,
              tool_use_id: id,
              name: mappedErr.uiName,
              output: toolOutputString,
              isError: true,
              input: mappedErr.uiInput
            },
          });
        }
        outputs.push({ call_id: id, output: pending.output });
      } else {
        const rejection = 'Tool use rejected by user';
        pending.output = rejection;
        pending.isError = true;

        const mappedRej = this.mapUiForTool(pending.name, pending.input);
        onMessage({
          type: 'agent:tool_output',
          sessionId,
          content: rejection,
          message: {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type: 'message',
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: id, content: rejection, is_error: true }],
            model: '',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
          toolOutput: {
            id,
            tool_use_id: id,
            name: mappedRej.uiName,
            output: rejection,
            isError: true,
            input: mappedRej.uiInput
          },
        });
        outputs.push({ call_id: id, output: rejection });
      }
    }

    // Remove processed ids
    for (const id of ids) delete state.pendingTools[id];

    if (outputs.length === 0) return;

    const client = this.initClient(apiKey);
    const inputContinuation = outputs.map(o => ({ type: 'function_call_output', call_id: o.call_id, output: o.output }));

    const sendDuringContinuation = (m) => {
      if (m.type === 'agent:tool_request' && m.toolRequest) {
        const tr = m.toolRequest;
        state.pendingTools[tr.id] = {
          name: (tr.providerName || tr.name),
          input: tr.input,
          responseId: tr.responseId
        };
      }
      onMessage(m);
    };

    onMessage({ type: 'agent:status', sessionId, phase: 'continuing' });
    this.abortFlags.set(sessionId, false);
    const controller2 = new AbortController();
    this.streamControllers.set(sessionId, controller2);

    const contResult = await processOpenAIStream({
      client,
      sessionId,
      content: inputContinuation,
      workingDir: state.workingDir,
      maxMode: state.maxMode,
      previousResponseId: responseIdForCall,
      projectContext: state.projectContext
        ? { sourcePath: state.projectContext.path, content: state.projectContext.content }
        : undefined,
      onMessage: sendDuringContinuation,
      abortSignal: controller2.signal,
      shouldAbort: () => !!this.abortFlags.get(sessionId),
    });

    this.streamControllers.delete(sessionId);

    if (contResult?.responseId && contResult.responseId.length > 0) {
      state.previousResponseId = contResult.responseId;
      try {
        await sessionStoreFs.setPreviousResponseId(sessionId, contResult.responseId);
      } catch {}
      logger.agent('openai:prev_response_id', sessionId, { previousResponseId: contResult.responseId });
    }

    await this.runAutoApproveCycle(sessionId, apiKey, onMessage);
  }

  /**
   * Get or create session
   * @param {string} sessionId - Session ID
   * @param {string} workingDir - Working directory
   * @param {boolean} maxMode - Max mode
   * @returns {OpenAISessionState} Session state
   */
  getOrCreateSession(sessionId, workingDir, maxMode) {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = {
        id: sessionId,
        workingDir,
        maxMode,
        previousResponseId: null,
        lastActivity: new Date(),
        title: 'New Chat',
        pendingTools: {}
      };
      this.sessions.set(sessionId, s);
    }
    s.workingDir = workingDir;
    s.maxMode = maxMode;
    s.lastActivity = new Date();
    return s;
  }

  /**
   * Process message
   * @param {any} message - Message data
   * @param {string} apiKey - API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   */
  async processMessage(message, apiKey, onMessage) {
    const { sessionId, content, workingDir = process.cwd(), maxMode = false } = message;

    logger.agent('openai:message_in', sessionId, { hasContent: !!content, workingDir, maxMode });

    if (!content) {
      onMessage({ type: 'agent:error', sessionId, error: 'No message content provided' });
      return;
    }

    const state = this.getOrCreateSession(sessionId, workingDir, maxMode);

    // Title generation on first message using Anthropic-based core generator
    if (!state.titleGenerated) {
      try {
        const title = await generateConversationTitle(typeof content === 'string' ? content : JSON.stringify(content));
        state.title = title || 'New Chat';
        state.titleGenerated = true;
        try {
          await sessionStoreFs.updateTitle(sessionId, state.title);
        } catch {}
        onMessage({ type: 'agent:title', sessionId, title: state.title });
      } catch {}
    }

    const client = this.initClient(apiKey);

    // Resolve project context once per session (prefer AGENTS.md for OpenAI)
    try {
      if (!state.projectContext) {
        const ctx = await loadProjectContext(workingDir, { preferred: 'agents' });
        if (ctx) {
          state.projectContext = { source: ctx.source, path: ctx.path, content: ctx.content };
        }
      }
    } catch {}

    // Wrap onMessage to capture tool requests for later approvals
    const send = (m) => {
      if (m.type === 'agent:tool_request' && m.toolRequest) {
        const tr = m.toolRequest;
        // Store provider tool name for execution; UI receives canonical name via STREAM adapter
        state.pendingTools[tr.id] = {
          name: (tr.providerName || tr.name),
          input: tr.input,
          responseId: tr.responseId
        };
      }
      onMessage(m);
    };

    // Record user message in session snapshot for authoritative conversation state
    try {
      await sessionStoreFs.recordUserMessage(sessionId, typeof content === 'string' ? content : JSON.stringify(content), { workingDir, maxMode });
    } catch {}

    // Build minimal input: only the latest user message
    const userText = typeof content === 'string' ? content : JSON.stringify(content);
    const historyInput = [{ role: 'user', content: userText }];

    // Pass previous_response_id when available
    const { previousResponseId } = state;
    const validPrev = previousResponseId || undefined;

    // Stream via Responses API and normalize to our events
    // Reset and attach abort controller for this turn
    this.abortFlags.set(sessionId, false);
    const controller = new AbortController();
    this.streamControllers.set(sessionId, controller);

    const result = await processOpenAIStream({
      client,
      sessionId,
      content: historyInput,
      workingDir,
      maxMode,
      previousResponseId: validPrev,
      projectContext: state.projectContext
        ? { sourcePath: state.projectContext.path, content: state.projectContext.content }
        : undefined,
      onMessage: send,
      abortSignal: controller.signal,
      shouldAbort: () => !!this.abortFlags.get(sessionId),
    });

    this.streamControllers.delete(sessionId);

    // Track prev response id for reasoning persistence (accept any non-empty id)
    if (result?.responseId && result.responseId.length > 0) {
      state.previousResponseId = result.responseId;
      try {
        await sessionStoreFs.setPreviousResponseId(sessionId, result.responseId);
      } catch {}
      logger.agent('openai:prev_response_id', sessionId, { previousResponseId: result.responseId });
    }

    // Auto-approve and execute any pending tools in Max Mode
    await this.runAutoApproveCycle(sessionId, apiKey, onMessage);
  }

  /**
   * Process tool response
   * @param {any} message - Message data
   * @param {string} apiKey - API key
   * @param {function(ServerMessage): void} onMessage - Message callback
   */
  async processToolResponse(message, apiKey, onMessage) {
    const { sessionId, toolResponse } = message;

    logger.agent('openai:tool_response_in', sessionId, { toolResponse });

    if (!toolResponse) {
      onMessage({ type: 'agent:error', sessionId, error: 'No tool response provided' });
      return;
    }

    const state = this.sessions.get(sessionId);
    if (!state) {
      onMessage({ type: 'agent:error', sessionId, error: 'Session not found' });
      return;
    }

    const { id, approved } = toolResponse;
    const pending = state.pendingTools[id];
    if (!pending) {
      onMessage({ type: 'agent:error', sessionId, error: 'Tool request not found' });
      logger.error('OpenAI', 'Pending tool not found', { sessionId, id });
      return;
    }

    // Record approval and check if the whole group is decided
    pending.approved = !!approved;
    const responseIdForCall = pending?.responseId || state.previousResponseId || undefined;
    if (!responseIdForCall) {
      onMessage({ type: 'agent:error', sessionId, error: 'Missing previous_response_id for continuation' });
      logger.error('OpenAI', 'Missing previous_response_id for continuation', { sessionId });
      return;
    }

    const groupIds = Object.entries(state.pendingTools)
      .filter(([_, v]) => (v.responseId || state.previousResponseId) === responseIdForCall)
      .map(([k]) => k);

    const allDecided = groupIds.every((gid) => typeof state.pendingTools[gid].approved === 'boolean');
    if (!allDecided) {
      onMessage({ type: 'agent:status', sessionId, phase: 'awaiting_tool' });
      logger.agent('openai:awaiting_more_approvals', sessionId, {
        responseIdSuffix: responseIdForCall.slice(-8),
        decided: groupIds.filter(g => typeof state.pendingTools[g].approved === 'boolean').length,
        total: groupIds.length
      });
      return;
    }

    await this.executeAndContinueGroup(sessionId, responseIdForCall, groupIds, apiKey, onMessage);
  }

  /**
   * Stop stream
   * @param {string} sessionId - Session ID
   */
  stopStream(sessionId) {
    try {
      this.abortFlags.set(sessionId, true);
      const c = this.streamControllers.get(sessionId);
      if (c) {
        try { c.abort(); } catch {}
      }
      // Clear any pending tools for the current (possibly partial) turn
      const s = this.sessions.get(sessionId);
      if (s) {
        s.pendingTools = {};
      }
    } catch {}
  }

  /**
   * Clear session
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

export const openAIService = new OpenAIServiceImpl();