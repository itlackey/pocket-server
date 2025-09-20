/**
 * Cursor Background Agent Types
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview Type definitions for Cursor integration
 */

/**
 * @typedef {'CREATING' | 'RUNNING' | 'FINISHED' | 'ERROR' | 'EXPIRED'} CloudAgentStatus
 */

/**
 * @typedef {Object} CreateAgentInput
 * @property {Object} prompt - Agent prompt
 * @property {string} prompt.text - Prompt text
 * @property {Array<{data: string, dimension?: {width: number, height: number}}>} [prompt.images] - Optional images
 * @property {Object} source - Source repository
 * @property {string} source.repository - Repository URL/path
 * @property {string} [source.ref] - Git reference (branch/commit)
 * @property {string} [model] - Model name (optional, Cursor picks if omitted)
 * @property {Object} [target] - Target configuration
 * @property {boolean} [target.autoCreatePr] - Whether to auto-create PR
 */

/**
 * @typedef {Object} CursorAgentMinimal
 * @property {string} id - Agent ID
 * @property {string} name - Agent name
 * @property {CloudAgentStatus} status - Agent status
 * @property {Object} source - Source repository
 * @property {string} source.repository - Repository URL/path
 * @property {string} [source.ref] - Git reference
 * @property {Object} [target] - Target information
 * @property {string} [target.branchName] - Target branch name
 * @property {string} [target.url] - Target URL
 * @property {string} [target.prUrl] - Pull request URL
 * @property {boolean} [target.autoCreatePr] - Auto-create PR flag
 * @property {string} [summary] - Agent summary
 * @property {string} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} CursorListAgentsResponse
 * @property {CursorAgentMinimal[]} agents - List of agents
 * @property {string} [nextCursor] - Pagination cursor
 */

/**
 * @typedef {Object} CursorConversationMessage
 * @property {string} id - Message ID
 * @property {'user_message' | 'assistant_message'} type - Message type
 * @property {string} text - Message text
 */

/**
 * @typedef {Object} CursorConversationResponse
 * @property {string} id - Conversation ID
 * @property {CursorConversationMessage[]} messages - Conversation messages
 */

/**
 * @typedef {Object} CloudAgentRecord
 * @property {string} id - Agent ID
 * @property {string} name - Agent name
 * @property {CloudAgentStatus} status - Agent status
 * @property {Object} source - Source repository
 * @property {string} source.repository - Repository URL/path
 * @property {string} [source.ref] - Git reference
 * @property {Object} [target] - Target information
 * @property {string} [target.branchName] - Target branch name
 * @property {string} [target.url] - Target URL
 * @property {string} [target.prUrl] - Pull request URL
 * @property {boolean} [target.autoCreatePr] - Auto-create PR flag
 * @property {string} [summary] - Agent summary
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 * @property {string} [ownerClientId] - Owner client ID
 */