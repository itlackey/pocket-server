/**
 * Tool Registry for Agent Tools
 * Manages registration and execution of tools for Claude agent
 *
 * @fileoverview Central registry for all agent tools
 */

import { bashToolDefinition, executeBash, isBashCommandDangerous } from '../anthropic/tools/bash.js';
import { editorToolDefinition, executeEditor } from '../anthropic/tools/editor.js';
import { webSearchToolDefinition, executeWebSearch } from '../anthropic/tools/web-search.js';
import { workPlanToolDefinition, executeWorkPlan } from '../anthropic/tools/work-plan.js';
import { logger } from '$lib/shared/logger.js';

/**
 * @typedef {Object} Tool
 * @property {string} type - Tool type identifier
 * @property {string} name - Tool name
 * @property {Function} execute - Tool execution function
 * @property {Function} [isDangerous] - Function to check if input is dangerous
 * @property {Object} [definition] - Tool definition for API
 */

/**
 * @typedef {Object} ToolExecution
 * @property {string} id - Execution ID
 * @property {string} name - Tool name
 * @property {any} input - Tool input
 * @property {any} result - Tool result
 * @property {boolean} success - Whether execution succeeded
 * @property {string} [error] - Error message if failed
 * @property {Date} timestamp - Execution timestamp
 */

class ToolRegistry {
  constructor() {
    /** @type {Map<string, Tool>} */
    this.tools = new Map();

    /** @type {Map<string, ToolExecution[]>} */
    this.executionHistory = new Map();

    // Register default tools
    this.registerDefaultTools();
  }

  /**
   * Register default tools
   */
  registerDefaultTools() {
    // Register bash tool
    this.register({
      type: bashToolDefinition.type,
      name: bashToolDefinition.name,
      definition: bashToolDefinition,
      execute: executeBash,
      isDangerous: isBashCommandDangerous
    });

    // Register text editor tool
    this.register({
      type: editorToolDefinition.type,
      name: editorToolDefinition.name,
      definition: editorToolDefinition,
      execute: executeEditor
    });

    // Register web search tool
    this.register({
      type: webSearchToolDefinition.type,
      name: webSearchToolDefinition.name,
      definition: webSearchToolDefinition,
      execute: executeWebSearch
    });

    // Register work plan tool
    this.register({
      type: 'work_plan_20250514',
      name: workPlanToolDefinition.name,
      definition: workPlanToolDefinition,
      execute: executeWorkPlan
    });

    logger.debug('ToolRegistry', 'Registered default tools', {
      tools: Array.from(this.tools.keys())
    });
  }

  /**
   * Register a tool
   * @param {Tool} tool - Tool to register
   */
  register(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    this.tools.set(tool.name, tool);
    logger.debug('ToolRegistry', `Registered tool: ${tool.name}`);
  }

  /**
   * Get tool by name
   * @param {string} name - Tool name
   * @returns {Tool|undefined} Tool if found
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions for Anthropic API
   * @returns {Array<Object>} Tool definitions
   */
  getAllDefinitions() {
    return Array.from(this.tools.values())
      .map(tool => tool.definition)
      .filter(def => def != null);
  }

  /**
   * Execute a tool
   * @param {string} sessionId - Session ID
   * @param {string} name - Tool name
   * @param {any} input - Tool input
   * @param {string} workingDir - Working directory
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async execute(sessionId, name, input, workingDir) {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`
      };
    }

    const executionId = crypto.randomUUID();
    const timestamp = new Date();

    try {
      logger.debug('ToolRegistry', `Executing tool: ${name}`, {
        sessionId,
        executionId,
        input
      });

      const result = await tool.execute(input, workingDir, sessionId);

      // Store execution in history
      const execution = {
        id: executionId,
        name,
        input,
        result,
        success: true,
        timestamp
      };

      this.addToHistory(sessionId, execution);

      logger.debug('ToolRegistry', `Tool execution successful: ${name}`, {
        sessionId,
        executionId
      });

      return {
        success: true,
        result
      };
    } catch (error) {
      logger.error('ToolRegistry', `Tool execution failed: ${name}`, {
        sessionId,
        executionId,
        error: error.message
      });

      // Store failed execution in history
      const execution = {
        id: executionId,
        name,
        input,
        result: null,
        success: false,
        error: error.message,
        timestamp
      };

      this.addToHistory(sessionId, execution);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if tool input is dangerous
   * @param {string} name - Tool name
   * @param {any} input - Tool input
   * @returns {boolean} Whether input is dangerous
   */
  isDangerous(name, input) {
    const tool = this.tools.get(name);

    if (!tool || !tool.isDangerous) {
      return false; // Default to safe if no check function
    }

    return tool.isDangerous(input);
  }

  /**
   * Add execution to history
   * @param {string} sessionId - Session ID
   * @param {ToolExecution} execution - Tool execution record
   */
  addToHistory(sessionId, execution) {
    let history = this.executionHistory.get(sessionId);

    if (!history) {
      history = [];
      this.executionHistory.set(sessionId, history);
    }

    history.push(execution);

    // Limit history to last 100 executions per session
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get execution history for a session
   * @param {string} sessionId - Session ID
   * @returns {ToolExecution[]} Execution history
   */
  getHistory(sessionId) {
    return this.executionHistory.get(sessionId) || [];
  }

  /**
   * Clear execution history for a session
   * @param {string} sessionId - Session ID
   */
  clearHistory(sessionId) {
    this.executionHistory.delete(sessionId);
  }

  /**
   * Get tool statistics for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Tool usage statistics
   */
  getStatistics(sessionId) {
    const history = this.getHistory(sessionId);

    const stats = {
      totalExecutions: history.length,
      successCount: history.filter(e => e.success).length,
      failureCount: history.filter(e => !e.success).length,
      toolUsage: {},
      recentExecutions: history.slice(-10) // Last 10 executions
    };

    // Count usage per tool
    history.forEach(execution => {
      if (!stats.toolUsage[execution.name]) {
        stats.toolUsage[execution.name] = {
          count: 0,
          successes: 0,
          failures: 0
        };
      }

      stats.toolUsage[execution.name].count++;
      if (execution.success) {
        stats.toolUsage[execution.name].successes++;
      } else {
        stats.toolUsage[execution.name].failures++;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();

// Export tool names for convenience
export const TOOL_NAMES = {
  BASH: 'bash',
  TEXT_EDITOR: 'str_replace_based_edit_tool',
  WEB_SEARCH: 'brave_search',
  WORK_PLAN: 'create_work_plan'
};