/**
 * Anthropic API Types
 * Direct mirror of Anthropic API - no abstraction layers
 * These types are the single source of truth shared between server and mobile
 */

/**
 * @typedef {'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn'} StopReason
 */

/**
 * @typedef {Object} Usage
 * @property {number} input_tokens
 * @property {number} output_tokens
 * @property {number} [cache_creation_input_tokens]
 * @property {number} [cache_read_input_tokens]
 * @property {Object} [server_tool_use]
 * @property {number} [server_tool_use.web_search_requests]
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {'message'} type
 * @property {'user' | 'assistant'} role
 * @property {ContentBlock[]} content
 * @property {string} model
 * @property {StopReason | null} stop_reason
 * @property {string | null} stop_sequence
 * @property {Usage} usage
 */

/**
 * @typedef {TextBlock | ToolUseBlock | ToolResultBlock | ServerToolUseBlock | WebSearchToolResultBlock | ThinkingBlock} ContentBlock
 */

/**
 * @typedef {Object} TextBlock
 * @property {'text'} type
 * @property {string} text
 * @property {Citation[]} [citations]
 */

/**
 * @typedef {Object} ToolUseBlock
 * @property {'tool_use'} type
 * @property {string} id
 * @property {string} name
 * @property {Record<string, any>} input
 */

/**
 * @typedef {Object} ToolResultBlock
 * @property {'tool_result'} type
 * @property {string} tool_use_id
 * @property {string | ContentBlock[]} content
 * @property {boolean} [is_error]
 */

/**
 * @typedef {Object} ServerToolUseBlock
 * @property {'server_tool_use'} type
 * @property {string} id
 * @property {string} name
 * @property {Record<string, any>} input
 */

/**
 * @typedef {Object} WebSearchToolResultBlock
 * @property {'web_search_tool_result'} type
 * @property {string} tool_use_id
 * @property {WebSearchResult[] | WebSearchError} content
 */

/**
 * @typedef {Object} ThinkingBlock
 * @property {'thinking'} type
 * @property {string} thinking
 * @property {string} [signature]
 * @property {number} [duration_ms]
 */

/**
 * @typedef {MessageStartEvent | ContentBlockStartEvent | ContentBlockDeltaEvent | ContentBlockStopEvent | MessageDeltaEvent | MessageStopEvent | PingEvent | ErrorEvent} StreamEvent
 */

/**
 * @typedef {Object} MessageStartEvent
 * @property {'message_start'} type
 * @property {Message} message
 */

/**
 * @typedef {Object} ContentBlockStartEvent
 * @property {'content_block_start'} type
 * @property {number} index
 * @property {ContentBlock} content_block
 */

/**
 * @typedef {Object} ContentBlockDeltaEvent
 * @property {'content_block_delta'} type
 * @property {number} index
 * @property {Delta} delta
 */

/**
 * @typedef {Object} ContentBlockStopEvent
 * @property {'content_block_stop'} type
 * @property {number} index
 */

/**
 * @typedef {Object} MessageDeltaEvent
 * @property {'message_delta'} type
 * @property {Object} delta
 * @property {StopReason} [delta.stop_reason]
 * @property {string | null} [delta.stop_sequence]
 * @property {Usage} [usage]
 */

/**
 * @typedef {Object} MessageStopEvent
 * @property {'message_stop'} type
 */

/**
 * @typedef {Object} PingEvent
 * @property {'ping'} type
 */

/**
 * @typedef {Object} ErrorEvent
 * @property {'error'} type
 * @property {Object} error
 * @property {string} error.type
 * @property {string} error.message
 */

/**
 * @typedef {TextDelta | InputJSONDelta | ThinkingDelta | SignatureDelta} Delta
 */

/**
 * @typedef {Object} TextDelta
 * @property {'text_delta'} type
 * @property {string} text
 */

/**
 * @typedef {Object} InputJSONDelta
 * @property {'input_json_delta'} type
 * @property {string} partial_json
 */

/**
 * @typedef {Object} ThinkingDelta
 * @property {'thinking_delta'} type
 * @property {string} thinking
 */

/**
 * @typedef {Object} SignatureDelta
 * @property {'signature_delta'} type
 * @property {string} signature
 */

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {Record<string, any>} input_schema
 */

/**
 * @typedef {Object} SpecialTool
 * @property {string} type
 * @property {string} name
 */

/**
 * @typedef {Object} BashTool
 * @property {'bash_20250124' | 'bash_20241022'} type
 * @property {'bash'} name
 */

/**
 * @typedef {Object} BashToolInput
 * @property {string} [command]
 * @property {boolean} [restart]
 */

/**
 * @typedef {Object} WebSearchTool
 * @property {'web_search_20250305'} type
 * @property {'web_search'} name
 * @property {number} [max_uses]
 * @property {string[]} [allowed_domains]
 * @property {string[]} [blocked_domains]
 * @property {UserLocation} [user_location]
 */

/**
 * @typedef {Object} WebSearchToolInput
 * @property {string} query
 */

/**
 * @typedef {Object} UserLocation
 * @property {'approximate'} type
 * @property {string} city
 * @property {string} region
 * @property {string} country
 * @property {string} timezone
 */

/**
 * @typedef {Object} TextEditorTool
 * @property {'text_editor_20250429' | 'text_editor_20250124' | 'text_editor_20241022'} type
 * @property {'str_replace_based_edit_tool'} name
 */

/**
 * @typedef {ViewCommand | StrReplaceCommand | CreateCommand | InsertCommand | UndoEditCommand} TextEditorCommand
 */

/**
 * @typedef {Object} ViewCommand
 * @property {'view'} command
 * @property {string} path
 * @property {[number, number]} [view_range]
 */

/**
 * @typedef {Object} StrReplaceCommand
 * @property {'str_replace'} command
 * @property {string} path
 * @property {string} old_str
 * @property {string} new_str
 */

/**
 * @typedef {Object} CreateCommand
 * @property {'create'} command
 * @property {string} path
 * @property {string} file_text
 */

/**
 * @typedef {Object} InsertCommand
 * @property {'insert'} command
 * @property {string} path
 * @property {number} insert_line
 * @property {string} new_str
 */

/**
 * @typedef {Object} UndoEditCommand
 * @property {'undo_edit'} command
 * @property {string} path
 */

/**
 * @typedef {WorkPlanCreateCommand | WorkPlanCompleteCommand | WorkPlanReviseCommand} WorkPlanCommand
 */

/**
 * @typedef {Object} WorkPlanCreateCommand
 * @property {'create'} command
 * @property {Array<{id: string, title: string, order: number, estimated_seconds?: number}>} items
 */

/**
 * @typedef {Object} WorkPlanCompleteCommand
 * @property {'complete'} command
 * @property {string} id
 */

/**
 * @typedef {Object} WorkPlanReviseCommand
 * @property {'revise'} command
 * @property {Array<{id: string, title?: string, order?: number, estimated_seconds?: number, remove?: boolean}>} items
 */

/**
 * @typedef {Object} WebSearchResult
 * @property {'web_search_result'} type
 * @property {string} url
 * @property {string} title
 * @property {string} encrypted_content
 * @property {string | null} page_age
 */

/**
 * @typedef {Object} WebSearchError
 * @property {'web_search_tool_result_error'} type
 * @property {'too_many_requests' | 'invalid_input' | 'max_uses_exceeded' | 'query_too_long' | 'unavailable'} error_code
 */

/**
 * @typedef {Object} Citation
 * @property {'web_search_result_location'} type
 * @property {string} url
 * @property {string} title
 * @property {string} encrypted_index
 * @property {string} cited_text
 */

/**
 * @typedef {Object} ConversationData
 * @property {string} id
 * @property {string} title
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {MessageParam[]} messages
 * @property {ConversationMetadata} metadata
 * @property {ConversationSettings} settings
 */

/**
 * @typedef {Object} ConversationMetadata
 * @property {string} model
 * @property {number} totalTokens
 * @property {string[]} [tags]
 * @property {string} [description]
 */

/**
 * @typedef {Object} ConversationSettings
 * @property {number} maxTokens
 * @property {number} [temperature]
 * @property {(Tool | SpecialTool)[]} [tools]
 * @property {ToolChoice} [toolChoice]
 * @property {string} [systemPrompt]
 * @property {ThinkingConfig} [thinking]
 */

/**
 * @typedef {Object} MessageParam
 * @property {'user' | 'assistant'} role
 * @property {string | ContentBlock[]} content
 * @property {CacheControl} [cache_control]
 */

/**
 * @typedef {Object} ToolChoice
 * @property {'auto' | 'any' | 'tool' | 'none'} type
 * @property {string} [name]
 * @property {boolean} [disable_parallel_tool_use]
 */

/**
 * @typedef {Object} ThinkingConfig
 * @property {'enabled'} type
 * @property {number} budget_tokens
 */

/**
 * @typedef {Object} CacheControl
 * @property {'ephemeral'} type
 */

/**
 * @typedef {'created' | 'starting' | 'ready' | 'streaming' | 'awaiting_tool' | 'tool_running' | 'paused' | 'completed' | 'error' | 'stopped'} AgentPhase
 */

/**
 * @typedef {Object} AgentSession
 * @property {string} id
 * @property {ConversationData} conversation
 * @property {StreamingStateData} streamingState
 * @property {string} workingDir
 * @property {boolean} maxMode
 * @property {Date} createdAt
 * @property {Date} lastActivity
 * @property {AbortController} [currentStreamController]
 * @property {AgentPhase} [phase]
 * @property {ToolRequest[]} [pendingTools]
 * @property {Object} [projectContext]
 * @property {'CLAUDE.md' | 'AGENTS.md'} [projectContext.source]
 * @property {string} [projectContext.path]
 * @property {string} [projectContext.content]
 */

/**
 * @typedef {Object} StreamingStateData
 * @property {Partial<Message> | null} currentMessage
 * @property {ContentBlock[]} contentBlocks
 * @property {number | null} activeBlockIndex
 * @property {string} activeBlockContent
 * @property {boolean} isStreaming
 * @property {ErrorEvent | null} error
 * @property {ToolRequest[]} [autoToolRequests]
 * @property {boolean} [aborted]
 */

/**
 * @typedef {Object} SessionSnapshot
 * @property {string} id
 * @property {string} title
 * @property {Date} createdAt
 * @property {Date} lastActivity
 * @property {number} messageCount
 * @property {string} workingDir
 * @property {boolean} maxMode
 * @property {AgentPhase} phase
 * @property {ToolRequest[]} pendingTools
 * @property {Object} conversation
 * @property {MessageParam[]} conversation.messages
 * @property {StreamingStateData} streamingState
 */

/**
 * @typedef {Object} ClientMessage
 * @property {'agent:message' | 'agent:tool_response' | 'agent:generate_title' | 'agent:stop'} type
 * @property {string} sessionId
 * @property {string} [content]
 * @property {string} [workingDir]
 * @property {boolean} [maxMode]
 * @property {boolean} [chatMode]
 * @property {Object} [toolResponse]
 * @property {string} [toolResponse.id]
 * @property {boolean} [toolResponse.approved]
 */

/**
 * @typedef {Object} ServerMessage
 * @property {'agent:assistant' | 'agent:tool_request' | 'agent:tool_output' | 'agent:tool_result_processed' | 'agent:error' | 'agent:thinking' | 'agent:title' | 'agent:session_started' | 'agent:stream_event' | 'agent:stream_complete' | 'agent:status'} type
 * @property {string} sessionId
 * @property {string} [content]
 * @property {ToolRequest} [toolRequest]
 * @property {ToolOutput} [toolOutput]
 * @property {Message} [message]
 * @property {Object} [toolResult]
 * @property {string} [toolResult.id]
 * @property {string} [toolResult.output]
 * @property {boolean} [toolResult.isError]
 * @property {string} [title]
 * @property {string} [error]
 * @property {string} [messageId]
 * @property {WebSearchResult[]} [searchResults]
 * @property {StreamEvent} [streamEvent]
 * @property {Message} [finalMessage]
 * @property {AgentPhase} [phase]
 * @property {boolean} [isComplete]
 */

/**
 * @typedef {Object} ToolRequest
 * @property {string} id
 * @property {string} name
 * @property {any} input
 * @property {string} [description]
 */

/**
 * @typedef {Object} ToolOutput
 * @property {string} id
 * @property {string} tool_use_id
 * @property {string} name
 * @property {string} output
 * @property {boolean} isError
 * @property {any} [input]
 */

export {}; // This makes the file a module