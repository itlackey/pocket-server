/**
 * Streaming Handler for Anthropic API
 * Uses async iteration pattern - the only pattern that works with Bun
 */

import './types.js'; // Import types for JSDoc

/**
 * @typedef {import('./types.js').ServerMessage} ServerMessage
 * @typedef {import('./types.js').ToolRequest} ToolRequest
 * @typedef {import('./types.js').StreamingStateData} StreamingStateData
 */

/**
 * @typedef {Object} StreamHandlerOptions
 * @property {string} sessionId
 * @property {string} workingDir
 * @property {boolean} maxMode
 * @property {boolean} chatMode
 * @property {function(ServerMessage): void} onMessage
 * @property {function(ToolRequest): Promise<void>} onToolRequest
 * @property {function(string, string, boolean): Promise<void>} onToolResultProcessed
 * @property {function(StreamingStateData): void} [onStateUpdated]
 */

/**
 * Process streaming response using async iteration - the only working pattern
 * @param {string} sessionId
 * @param {string} workingDir
 * @param {boolean} maxMode
 * @param {boolean} chatMode
 * @param {function(any): void} onMessage
 * @param {function(any): Promise<void>} onToolRequest
 * @param {function(string, string, boolean): Promise<void>} onToolResultProcessed
 * @param {import('@anthropic-ai/sdk').Anthropic} anthropic
 * @param {any} streamConfig
 * @param {function(any): void} [onStateUpdated]
 * @param {function(): boolean} [shouldAbort]
 * @param {AbortSignal} [abortSignal]
 * @returns {Promise<any>}
 */
export async function processStream(
  sessionId,
  workingDir,
  maxMode,
  chatMode,
  onMessage,
  onToolRequest,
  onToolResultProcessed,
  anthropic,
  streamConfig,
  onStateUpdated,
  shouldAbort,
  abortSignal
) {
  // Initialize streaming state
  /** @type {any} */
  const state = {
    currentMessage: null,
    contentBlocks: [],
    activeBlockIndex: null,
    activeBlockContent: '',
    isStreaming: true,
    error: null,
    autoToolRequests: []
  };

  // Track accumulated content for text blocks
  let allAccumulatedContent = '';
  let currentBlockContent = '';
  let messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Track tool use blocks being built
  let currentToolUse = null;
  let toolInputJsonBuffer = '';
  
  // Track current block index
  let currentBlockIndex = -1;

  try {
    console.log(`[Streaming] Starting async iteration for session: ${sessionId}`);
    
    // Create the stream
    const stream = anthropic.messages.stream(streamConfig);
    
    // Process events using async iteration - THE ONLY PATTERN THAT WORKS
    for await (const event of stream) {
      // Cooperative abort: if caller requests stop, terminate the provider stream and exit
      if ((shouldAbort && shouldAbort()) || (abortSignal && abortSignal.aborted)) {
        try { 
          if (stream.controller?.abort) stream.controller.abort();
        } catch {}
        try { 
          if (stream.abort) stream.abort();
        } catch {}
        
        // Finalize active text block content if any so UI keeps what it saw
        if (state.activeBlockIndex !== null && state.activeBlockIndex < state.contentBlocks.length) {
          const blk = state.contentBlocks[state.activeBlockIndex];
          if (blk && blk.type === 'text') {
            state.contentBlocks[state.activeBlockIndex] = { type: 'text', text: currentBlockContent };
          }
        }
        state.isStreaming = false;
        state.aborted = true;
        onMessage({ type: 'agent:stream_event', sessionId, streamEvent: { type: 'message_stop' } });
        
        // Synthesize a minimal final message to align with client expectations
        const synthesizedFinal = {
          id: state.currentMessage?.id || messageId,
          type: 'message',
          role: 'assistant',
          content: state.contentBlocks,
          model: 'claude-sonnet-4-20250514',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
        onMessage({ type: 'agent:stream_complete', sessionId, finalMessage: synthesizedFinal });
        onMessage({ type: 'agent:status', sessionId, phase: 'stopped' });
        return state;
      }
      
      console.log(`[Streaming] Event type: ${event.type}`);
      
      // Send raw event to client for real-time updates
      onMessage({
        type: 'agent:stream_event',
        sessionId,
        streamEvent: event
      });
      
      switch (event.type) {
        case 'message_start':
          console.log(`[Streaming] Message started: ${event.message.id}`);
          state.currentMessage = { ...event.message };
          messageId = event.message.id;
          // Phase: streaming
          onMessage({ type: 'agent:status', sessionId, phase: 'streaming' });
          onStateUpdated?.(state);
          
          // Send thinking indicator
          onMessage({
            type: 'agent:thinking',
            sessionId,
            content: ''
          });
          break;
          
        case 'content_block_start': {
          currentBlockIndex = event.index;
          const block = { ...event.content_block };
          state.contentBlocks.push(block);
          state.activeBlockIndex = event.index;
          
          console.log(`[Streaming] Content block started: index=${event.index}, type=${block.type}`);
          
          if (block.type === 'text') {
            currentBlockContent = '';
          } else if (block.type === 'tool_use') {
            currentToolUse = block;
            toolInputJsonBuffer = '';
            
            // Emit tool request start message
            onMessage({
              type: 'agent:tool_request_start',
              sessionId,
              toolId: block.id,
              toolName: block.name
            });
          }
          onStateUpdated?.(state);
          break;
        }
          
        case 'content_block_delta':
          if (event.index !== currentBlockIndex) {
            console.warn(`[Streaming] Block index mismatch: ${event.index} vs ${currentBlockIndex}`);
          }
          
          if (event.delta.type === 'text_delta') {
            const deltaText = event.delta.text;
            console.log(`[Streaming] Text delta: "${deltaText}"`);
            
            // Accumulate text
            currentBlockContent += deltaText;
            allAccumulatedContent += deltaText;
            state.activeBlockContent = currentBlockContent;
            onStateUpdated?.(state);
            
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            // Accumulate JSON for tool input
            toolInputJsonBuffer += event.delta.partial_json || '';
            console.log(`[Streaming] Tool input JSON delta: ${event.delta.partial_json}`);
            onStateUpdated?.(state);
            
          } else if (event.delta.type === 'thinking_delta') {
            // Accumulate thinking text into the active thinking block
            const idx = event.index;
            const blocks = state.contentBlocks;
            const blk = blocks[idx];
            if (blk && blk.type === 'thinking') {
              blk.thinking = (blk.thinking || '') + event.delta.thinking;
            }
            onStateUpdated?.(state);
          } else if (event.delta.type === 'signature_delta') {
            // Attach encrypted signature to thinking block
            const idx = event.index;
            const blk = state.contentBlocks[idx];
            if (blk && blk.type === 'thinking') {
              blk.signature = event.delta.signature;
            }
            onStateUpdated?.(state);
          }
          break;
          
        case 'content_block_stop':
          console.log(`[Streaming] Content block stopped: index=${event.index}`);
          
          if (state.activeBlockIndex !== null && state.activeBlockIndex < state.contentBlocks.length) {
            const block = state.contentBlocks[state.activeBlockIndex];
            
            if (block.type === 'text') {
              // Update text block with final content
              block.text = currentBlockContent;
              currentBlockContent = '';
              onStateUpdated?.(state);
              
            } else if (block.type === 'tool_use' && currentToolUse) {
              // Parse and handle tool use
              try {
                if (toolInputJsonBuffer) {
                  currentToolUse.input = JSON.parse(toolInputJsonBuffer);
                }
                
                // Create tool request
                /** @type {any} */
                const toolRequest = {
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: currentToolUse.input || {},
                  description: generateToolDescription(currentToolUse.name, currentToolUse.input)
                };
                
                console.log(`[Streaming] Tool request: ${toolRequest.name} - ${toolRequest.description}`);
                
                // For Max (chatMode === false) auto-approval: queue tool requests to execute AFTER this stream completes,
                // so we can send them back to the API in the required "user tool_result" message format.
                // Auto-approve safe tools in Max mode, and always auto-approve work_plan
                if (!chatMode && isToolSafe(toolRequest)) {
                  state.autoToolRequests?.push(toolRequest);
                } else {
                  // Chat mode: send to client for manual approval
                  await onToolRequest(toolRequest);
                  onMessage({ type: 'agent:status', sessionId, phase: 'awaiting_tool' });
                }
                
              } catch (error) {
                console.error('[Streaming] Failed to parse tool input:', error);
              }
              
              // Reset tool tracking
              currentToolUse = null;
              toolInputJsonBuffer = '';
            }
          }
          
          state.activeBlockIndex = null;
          break;
          
        case 'message_delta':
          console.log(`[Streaming] Message delta: stop_reason=${event.delta.stop_reason}`);
          break;
          
        case 'message_stop':
          console.log(`[Streaming] Message stopped`);
          state.isStreaming = false;
          // Phase transition will finalize after finalMessage fetch, but emit tentative ready
          onMessage({ type: 'agent:status', sessionId, phase: 'ready' });
          onStateUpdated?.(state);
          
          // Message completion is already sent via agent:stream_event
          // Final complete message will be sent via agent:stream_complete after the loop
          break;
          
        default:
          // Handle error events that might not be in the type union
          if (event && typeof event === 'object' && 'error' in event) {
            const errorEvent = /** @type {any} */ (event);
            console.error(`[Streaming] Error event:`, errorEvent.error);
            state.error = {
              type: 'error',
              error: errorEvent.error
            };
            state.isStreaming = false;
            onMessage({ type: 'agent:status', sessionId, phase: 'error' });
            onStateUpdated?.(state);
            
            onMessage({
              type: 'agent:error',
              sessionId,
              error: errorEvent.error?.message || 'Unknown error'
            });
          }
          break;
      }
    }
    
    // Get the final message after stream completes
    const finalMessage = await stream.finalMessage();
    console.log(`[Streaming] Got final message with ${finalMessage.content.length} content blocks`);
    
    // Send the complete final message (keep the same id as the message_start for dedupe on client)
    const normalizedFinal = { ...finalMessage };
    if (state.currentMessage?.id && normalizedFinal.id !== state.currentMessage.id) {
      normalizedFinal.id = state.currentMessage.id;
    }
    onMessage({
      type: 'agent:stream_complete',
      sessionId,
      finalMessage: normalizedFinal
    });
    
    // Ensure state reflects the complete final message blocks, including thinking + signature
    try {
      state.contentBlocks = [...finalMessage.content];
      state.finalMessage = normalizedFinal; // Store finalMessage in state for conversation history
    } catch {
      // ignore
    }
    
    // Final stop_reason determines terminal phase
    const stop = finalMessage.stop_reason;
    if (stop === 'pause_turn') {
      onMessage({ type: 'agent:status', sessionId, phase: 'paused' });
    } else if (stop === 'end_turn' || stop === 'stop_sequence' || stop === 'max_tokens' || stop === null) {
      onMessage({ type: 'agent:status', sessionId, phase: 'completed' });
    }
    onStateUpdated?.(state);
    
    console.log(`[Streaming] Stream processing completed for session: ${sessionId}`);
    
  } catch (error) {
    console.error(`[Streaming] Stream processing error:`, error);
    state.error = {
      type: 'error',
      error: {
        type: 'stream_processing_error',
        message: error.message
      }
    };
    state.isStreaming = false;
    
    onMessage({
      type: 'agent:error',
      sessionId,
      error: error.message
    });
  }

  return state;
}

/**
 * Check if tool is safe for auto-approval
 * @param {any} request
 * @returns {boolean}
 */
function isToolSafe(request) {
  // Import tool safety checks dynamically to avoid circular imports
  switch (request.name) {
    case 'bash':
      // We'll implement these functions in the tools modules
      return !isBashCommandDangerous(request.input?.command || '');
    case 'str_replace_based_edit_tool':
      return !isEditorCommandDangerous(request.input);
    case 'web_search':
      return true; // Web search is always safe
    case 'work_plan':
      return true; // Server-local plan state; safe
    default:
      return false;
  }
}

/**
 * Generate human-readable tool description
 * @param {string} toolName
 * @param {any} input
 * @returns {string}
 */
function generateToolDescription(toolName, input) {
  if (toolName === 'bash' && input?.command) {
    return `Execute: ${input.command}`;
  } else if (toolName === 'str_replace_based_edit_tool') {
    const { command, path } = input || {};
    const filename = path ? path.split('/').pop() : 'file';
    
    switch (command) {
      case 'view':
        return `View ${filename}`;
      case 'str_replace':
        return `Edit ${filename}`;
      case 'create':
        return `Create ${filename}`;
      case 'insert':
        return `Insert text in ${filename}`;
      default:
        return `File operation on ${filename}`;
    }
  } else if (toolName === 'web_search' && input?.query) {
    return `Search: ${input.query}`;
  } else if (toolName === 'work_plan') {
    if (input?.command === 'create' && Array.isArray(input?.items)) {
      return `Create work plan: ${input.items.length} steps`;
    }
    if (input?.command === 'complete') {
      return `Complete step ${input.id}`;
    }
    if (input?.command === 'revise') {
      return `Revise work plan (${(input.items || []).length} changes)`;
    }
  }
  
  return 'Execute tool';
}

// Temporary placeholder functions - these will be properly imported later
function isBashCommandDangerous(command) {
  // Basic safety check - to be replaced with proper import
  const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', 'dd if=', 'format', 'fdisk'];
  return dangerousCommands.some(dangerous => command.toLowerCase().includes(dangerous));
}

function isEditorCommandDangerous(input) {
  // Basic safety check - to be replaced with proper import
  const { command, path } = input || {};
  if (command === 'create' || command === 'str_replace') {
    return path && (path.includes('/etc/') || path.includes('/system/') || path.includes('/boot/'));
  }
  return false;
}