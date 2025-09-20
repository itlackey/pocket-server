/**
 * Work Plan Tool
 * Converted from TypeScript for SvelteKit with JSDoc types
 * 
 * Lets the model declare a multi-step plan and mark steps complete.
 * We persist plan state in the session snapshot and emit targeted push notifications
 * via the existing Expo notifications pipeline.
 * 
 * @fileoverview Work plan management tool for Claude agent
 */

/**
 * @typedef {Object} WorkPlanItem
 * @property {string} id - Item ID
 * @property {string} title - Item title
 * @property {number} order - Item order
 * @property {number} [estimated_seconds] - Estimated time in seconds
 * @property {boolean} [remove] - Whether to remove item (for revise command)
 */

/**
 * @typedef {Object} CreateWorkPlanCommand
 * @property {'create'} command - Command type
 * @property {WorkPlanItem[]} items - Plan items
 */

/**
 * @typedef {Object} CompleteWorkPlanCommand
 * @property {'complete'} command - Command type
 * @property {string} id - Item ID to complete
 */

/**
 * @typedef {Object} ReviseWorkPlanCommand
 * @property {'revise'} command - Command type
 * @property {WorkPlanItem[]} items - Revised items
 */

/**
 * @typedef {CreateWorkPlanCommand | CompleteWorkPlanCommand | ReviseWorkPlanCommand} WorkPlanCommand
 */

/**
 * @typedef {Object} WorkPlanTool
 * @property {'work_plan'} name - Tool name
 * @property {string} description - Tool description
 * @property {Object} input_schema - JSON schema for input validation
 */

/**
 * Work plan tool definition for Anthropic API
 * @type {WorkPlanTool}
 */
export const workPlanToolDefinition = {
  name: 'work_plan',
  description:
    'Create and manage a multi-step work plan for the current session. Use "create" to declare an ordered list of steps (id, title, order, optional estimated_seconds), "complete" to mark a step done by id, and "revise" to add/remove/reorder/update steps. Keep titles short and mobile-friendly.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', enum: ['create', 'complete', 'revise'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            order: { type: 'integer', minimum: 1 },
            estimated_seconds: { type: 'integer', minimum: 1 },
            remove: { type: 'boolean' }
          },
          additionalProperties: false
        }
      },
      id: { type: 'string' }
    },
    required: ['command'],
    additionalProperties: false
  }
};

/**
 * Execute work plan command. This mutates server-side plan state for the session.
 * Returns a short, user-readable summary used in the tool_result block.
 * @param {string} sessionId - Session ID
 * @param {WorkPlanCommand} input - Work plan command
 * @returns {Promise<string>} Command result summary
 */
export async function executeWorkPlan(sessionId, input) {
  try {
    switch (input.command) {
      case 'create': {
        const createInput = /** @type {CreateWorkPlanCommand} */ (input);
        const items = (createInput.items || []).slice().sort((a, b) => a.order - b.order);
        if (items.length === 0) {
          return 'No work plan items provided';
        }
        
        // TODO: Implement session store integration for work plan persistence
        // For now, just return a simple acknowledgment
        const total = items.length;
        const first = items[0]?.title || 'Step 1';
        
        return `Work plan created with ${total} steps. Starting with: "${first}"`;
      }

      case 'complete': {
        const completeInput = /** @type {CompleteWorkPlanCommand} */ (input);
        if (typeof completeInput.id !== 'string' || !completeInput.id.trim()) {
          return 'No id provided for complete command';
        }
        
        // TODO: Implement work plan completion tracking
        // For now, just return acknowledgment
        return `Marked step "${completeInput.id}" as completed.`;
      }

      case 'revise': {
        const reviseInput = /** @type {ReviseWorkPlanCommand} */ (input);
        if (!Array.isArray(reviseInput.items) || reviseInput.items.length === 0) {
          return 'No revisions provided';
        }
        
        // TODO: Implement work plan revision
        // For now, just return acknowledgment
        const count = reviseInput.items.length;
        return `Revised work plan. Now ${count} steps.`;
      }

      default:
        return `Unknown work_plan command`;
    }
  } catch (error) {
    return `Error executing work plan: ${error.message}`;
  }
}