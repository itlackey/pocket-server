/**
 * OpenAI Responses API Streaming Normalizer
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Maps GPT-5 events to our `agent:stream_event` / `agent:stream_complete`
 *
 * @fileoverview OpenAI streaming response processing
 */

import { randomUUID } from 'node:crypto';
import { logger } from '$lib/shared/logger.js';
import { generateSystemPromptOpenAI } from './prompt.js';
import { openaiToolDefinitions } from './tools/index.js';

/**
 * @typedef {Object} ProcessArgs
 * @property {import('openai').OpenAI} client - OpenAI client
 * @property {string} sessionId - Session ID
 * @property {string | any[]} content - Message content
 * @property {string} workingDir - Working directory
 * @property {boolean} maxMode - Max mode enabled
 * @property {string} [previousResponseId] - Previous response ID
 * @property {function(any): void} onMessage - Message callback
 * @property {AbortSignal} [abortSignal] - Abort signal
 * @property {function(): boolean} [shouldAbort] - Should abort check
 * @property {Object} [projectContext] - Project context
 * @property {string} projectContext.sourcePath - Source path
 * @property {string} projectContext.content - Content
 */

/**
 * Process OpenAI stream
 * @param {ProcessArgs} args - Process arguments
 * @returns {Promise<{responseId?: string} | undefined>} Result with response ID
 */
export async function processOpenAIStream(args) {
  const {
    client,
    sessionId,
    content,
    previousResponseId,
    onMessage,
    workingDir,
    abortSignal,
    shouldAbort,
    projectContext
  } = args;

  // Helpers for bounded, structured diagnostics (avoid log floods and secrets)
  const clip = (s, max = 160) => (typeof s === 'string' && s.length > max ? `${s.slice(0, max)}…` : s);
  const safeJson = (obj, max = 240) => {
    try {
      const str = JSON.stringify(obj);
      return clip(str || '', max);
    } catch {
      return '[unserializable]';
    }
  };

  // Placeholder streaming implementation: call Responses API non-streaming for scaffolding,
  // then emit a minimal set of events. Detailed streaming can replace this once wired end-to-end.
  try {
    const instructions = generateSystemPromptOpenAI({
      workingDirectory: workingDir,
      projectContext: projectContext,
    });

    logger.agent('openai:request', sessionId, { previousResponseId: previousResponseId ?? null });

    const params = {
      model: 'gpt-5',
      instructions,
      input: typeof content === 'string' ? content : content,
      tools: openaiToolDefinitions,
      tool_choice: {
        type: 'allowed_tools',
        mode: 'auto',
        tools: openaiToolDefinitions.map((t) => ({ type: 'function', name: t.name })),
      },
      parallel_tool_calls: true,
      reasoning: { effort: 'high', summary: 'auto' },
      text: { verbosity: 'medium' },
      include: ['reasoning.encrypted_content'],
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      store: true,
      stream: true,
    };

    const options = abortSignal ? { signal: abortSignal } : undefined;
    const stream = options ? await client.responses.create(params, options) : await client.responses.create(params);

    logger.agent('openai:stream_started', sessionId, {
      inputShape: Array.isArray(content) ? 'array' : typeof content,
      toolCount: Array.isArray(openaiToolDefinitions) ? openaiToolDefinitions.length : 0,
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
      verbosity: 'medium',
    });

    let emittedStart = false;
    let messageId; // UI message id
    let openaiResponseId; // OpenAI response id for previous_response_id
    let blockIdx = 0;
    // Track live blocks and aggregates
    let thinkingBlockStarted = false;
    let thinkingBlockIndex = -1;
    let textBlockStarted = false;
    let textBlockIndex = -1;
    let aggregatedThinking = '';
    let aggregatedText = '';
    const toolAgg = {};
    let sawToolCall = false; // if true, do not finalize this turn; await tool outputs
    let completedResponse; // capture final response payload from 'response.completed'

    // Stream events
    for await (const event of stream) {
      if (shouldAbort && shouldAbort()) {
        logger.agent('openai:stream_aborted', sessionId);
        break;
      }

      logger.agent('openai:stream_event', sessionId, { type: event.type });

      switch (event.type) {
        case 'response.created': {
          openaiResponseId = event.response?.id;
          messageId = randomUUID();
          if (!emittedStart) {
            onMessage({ type: 'agent:stream_start', sessionId, messageId });
            emittedStart = true;
          }
          break;
        }

        case 'response.content_block.started': {
          const block = event.content_block;
          blockIdx = event.index || 0;

          if (block?.type === 'reasoning') {
            thinkingBlockStarted = true;
            thinkingBlockIndex = blockIdx;
            aggregatedThinking = '';
          } else if (block?.type === 'text') {
            textBlockStarted = true;
            textBlockIndex = blockIdx;
            aggregatedText = '';
          }
          break;
        }

        case 'response.content_block.delta': {
          const delta = event.delta;
          const blockIndex = event.index || 0;

          if (delta?.type === 'reasoning_delta' && thinkingBlockStarted && blockIndex === thinkingBlockIndex) {
            // Aggregate reasoning content
            aggregatedThinking += delta.content || '';
          } else if (delta?.type === 'text_delta' && textBlockStarted && blockIndex === textBlockIndex) {
            // Stream text content
            const textDelta = delta.text || '';
            aggregatedText += textDelta;
            if (textDelta) {
              onMessage({
                type: 'agent:stream_event',
                sessionId,
                messageId,
                event: { type: 'content_block_delta', delta: { type: 'text_delta', text: textDelta } }
              });
            }
          }
          break;
        }

        case 'response.content_block.completed': {
          const blockIndex = event.index || 0;

          if (thinkingBlockStarted && blockIndex === thinkingBlockIndex) {
            // Send complete thinking block
            if (aggregatedThinking) {
              onMessage({
                type: 'agent:stream_event',
                sessionId,
                messageId,
                event: {
                  type: 'content_block_start',
                  content_block: { type: 'text', text: aggregatedThinking }
                }
              });
            }
            thinkingBlockStarted = false;
          } else if (textBlockStarted && blockIndex === textBlockIndex) {
            textBlockStarted = false;
          }
          break;
        }

        case 'response.function_call.started': {
          const func = event.function_call;
          const callId = func?.call_id;
          if (callId) {
            toolAgg[blockIdx] = {
              callId,
              name: func.name || '',
              args: ''
            };
            sawToolCall = true;
          }
          break;
        }

        case 'response.function_call.delta': {
          const delta = event.delta;
          const blockIndex = event.index || 0;
          if (toolAgg[blockIndex] && delta?.arguments) {
            toolAgg[blockIndex].args += delta.arguments;
          }
          break;
        }

        case 'response.function_call.completed': {
          const blockIndex = event.index || 0;
          const tool = toolAgg[blockIndex];
          if (tool) {
            try {
              const parsed = JSON.parse(tool.args);
              const itemId = randomUUID();
              tool.itemId = itemId;

              onMessage({
                type: 'agent:tool_request',
                sessionId,
                messageId,
                toolRequest: {
                  id: tool.callId,
                  name: tool.name,
                  providerName: tool.name,
                  input: parsed,
                  responseId: openaiResponseId
                }
              });
            } catch (e) {
              logger.error('OpenAI', 'Failed to parse tool arguments', { sessionId, error: e.message });
            }
          }
          break;
        }

        case 'response.completed': {
          completedResponse = event.response;
          break;
        }

        default:
          // Log unknown events for debugging
          logger.debug('OpenAI', 'Unknown stream event', { type: event.type, sessionId });
          break;
      }
    }

    // Emit completion
    if (emittedStart) {
      const stopReason = sawToolCall ? 'tool_use' : 'end_turn';
      onMessage({
        type: 'agent:stream_complete',
        sessionId,
        messageId,
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: aggregatedText ? [{ type: 'text', text: aggregatedText }] : [],
          model: 'gpt-5',
          stop_reason: stopReason,
          stop_sequence: null,
          usage: completedResponse?.usage || { input_tokens: 0, output_tokens: 0 },
        }
      });
    }

    logger.agent('openai:stream_complete', sessionId, {
      responseId: openaiResponseId,
      stopReason: sawToolCall ? 'tool_use' : 'end_turn',
      hasThinking: aggregatedThinking.length > 0,
      textLength: aggregatedText.length,
      toolCalls: Object.keys(toolAgg).length
    });

    return { responseId: openaiResponseId };

  } catch (error) {
    logger.error('OpenAI', 'Stream processing failed', { sessionId, error: error.message });

    onMessage({
      type: 'agent:error',
      sessionId,
      error: error.message
    });

    throw error;
  }
}