/**
 * Agent session types and interfaces
 */

/**
 * @typedef {Object} SessionIndexItem
 * @property {string} id - Session ID
 * @property {string} title - Session title
 * @property {string} createdAt - Creation timestamp (ISO)
 * @property {string} lastActivity - Last activity timestamp (ISO)
 * @property {number} messageCount - Number of messages
 * @property {string} workingDir - Working directory
 * @property {boolean} maxMode - Whether max mode is enabled
 * @property {string} [phase] - Current session phase
 */

/**
 * @typedef {Object} WorkPlan
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Update timestamp
 * @property {WorkPlanItem[]} items - Work plan items
 */

/**
 * @typedef {Object} WorkPlanItem
 * @property {string} id - Item ID
 * @property {string} title - Item title
 * @property {number} order - Item order
 * @property {number} [estimated_seconds] - Estimated completion time
 * @property {'pending' | 'complete'} status - Item status
 * @property {string} [completedAt] - Completion timestamp
 */

/**
 * @typedef {Object} StreamingState
 * @property {any} currentMessage - Current streaming message
 * @property {any[]} contentBlocks - Content blocks
 * @property {number} activeBlockIndex - Active block index
 * @property {string} activeBlockContent - Active block content
 * @property {boolean} isStreaming - Whether currently streaming
 * @property {string} [error] - Current error if any
 */

/**
 * @typedef {Object} Conversation
 * @property {any[]} messages - Conversation messages
 */

/**
 * @typedef {Object} SessionSnapshot
 * @property {string} id - Session ID
 * @property {string} title - Session title
 * @property {string} createdAt - Creation timestamp (ISO)
 * @property {string} lastActivity - Last activity timestamp (ISO)
 * @property {number} messageCount - Number of messages
 * @property {string} workingDir - Working directory
 * @property {boolean} maxMode - Whether max mode is enabled
 * @property {string} [phase] - Current session phase
 * @property {any[]} [pendingTools] - Pending tool calls
 * @property {string} [initiatorDeviceId] - Device that initiated the session
 * @property {string} [previousResponseId] - Previous response ID
 * @property {WorkPlan} [workPlan] - Session work plan
 * @property {Conversation} conversation - Session conversation
 * @property {StreamingState} [streamingState] - Current streaming state
 * @property {number} [lastSeq] - Last sequence number
 */

/**
 * @typedef {Object} CreateSessionOptions
 * @property {string} workingDir - Working directory
 * @property {boolean} [maxMode] - Enable max mode
 * @property {string} [title] - Session title
 * @property {string} [id] - Specific session ID
 */