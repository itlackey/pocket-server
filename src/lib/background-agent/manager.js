/**
 * Background Agent Manager
 * Manages background agent processes and task scheduling
 *
 * @fileoverview Background agent management system
 */

import { logger } from '$lib/shared/logger.js';
import { EventEmitter } from 'events';

/**
 * @typedef {Object} BackgroundTask
 * @property {string} id - Task ID
 * @property {string} type - Task type
 * @property {any} payload - Task payload
 * @property {'pending' | 'running' | 'completed' | 'failed'} status - Task status
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [startedAt] - Start timestamp
 * @property {Date} [completedAt] - Completion timestamp
 * @property {string} [error] - Error message if failed
 * @property {any} [result] - Task result if completed
 */

/**
 * @typedef {Object} BackgroundAgent
 * @property {string} id - Agent ID
 * @property {string} type - Agent type (e.g., 'cursor', 'webhook')
 * @property {'idle' | 'busy' | 'error' | 'stopped'} status - Agent status
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} lastActivity - Last activity timestamp
 * @property {BackgroundTask[]} activeTasks - Currently active tasks
 * @property {Object} config - Agent configuration
 */

/**
 * Background Agent Manager
 * Manages background agents and task distribution
 */
export class BackgroundAgentManager extends EventEmitter {
  constructor() {
    super();

    /** @type {Map<string, BackgroundAgent>} */
    this.agents = new Map();

    /** @type {Map<string, BackgroundTask>} */
    this.tasks = new Map();

    /** @type {BackgroundTask[]} */
    this.taskQueue = [];

    /** @type {NodeJS.Timeout|null} */
    this.processInterval = null;

    /** @type {NodeJS.Timeout|null} */
    this.cleanupInterval = null;

    this.startProcessing();
  }

  /**
   * Start processing tasks
   */
  startProcessing() {
    if (this.processInterval) return;

    // Process queue every 5 seconds
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 5000);

    // Cleanup completed tasks every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    logger.info('BackgroundAgentManager', 'Started processing');
  }

  /**
   * Stop processing tasks
   */
  stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('BackgroundAgentManager', 'Stopped processing');
  }

  /**
   * Register a background agent
   * @param {string} id - Agent ID
   * @param {string} type - Agent type
   * @param {Object} config - Agent configuration
   * @returns {BackgroundAgent} Registered agent
   */
  registerAgent(id, type, config = {}) {
    const agent = {
      id,
      type,
      status: 'idle',
      createdAt: new Date(),
      lastActivity: new Date(),
      activeTasks: [],
      config
    };

    this.agents.set(id, agent);

    logger.info('BackgroundAgentManager', `Registered agent: ${id}`, {
      type,
      config: Object.keys(config)
    });

    this.emit('agent:registered', agent);
    return agent;
  }

  /**
   * Unregister a background agent
   * @param {string} id - Agent ID
   */
  unregisterAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Cancel active tasks
    agent.activeTasks.forEach(task => {
      this.updateTaskStatus(task.id, 'failed', 'Agent unregistered');
    });

    this.agents.delete(id);

    logger.info('BackgroundAgentManager', `Unregistered agent: ${id}`);
    this.emit('agent:unregistered', agent);
  }

  /**
   * Submit a task to the queue
   * @param {string} type - Task type
   * @param {any} payload - Task payload
   * @param {Object} [options] - Task options
   * @returns {BackgroundTask} Created task
   */
  submitTask(type, payload, options = {}) {
    const task = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
      ...options
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);

    logger.debug('BackgroundAgentManager', `Task submitted: ${task.id}`, {
      type,
      queueLength: this.taskQueue.length
    });

    this.emit('task:submitted', task);
    return task;
  }

  /**
   * Process the task queue
   */
  async processQueue() {
    if (this.taskQueue.length === 0) return;

    // Find available agents
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'idle');

    if (availableAgents.length === 0) {
      logger.debug('BackgroundAgentManager', 'No available agents');
      return;
    }

    // Process tasks
    const tasksToProcess = this.taskQueue.splice(0, availableAgents.length);

    for (let i = 0; i < tasksToProcess.length; i++) {
      const task = tasksToProcess[i];
      const agent = availableAgents[i];

      try {
        await this.assignTaskToAgent(task, agent);
      } catch (error) {
        logger.error('BackgroundAgentManager', 'Failed to assign task', {
          taskId: task.id,
          agentId: agent.id,
          error: error.message
        });

        this.updateTaskStatus(task.id, 'failed', error.message);
      }
    }
  }

  /**
   * Assign a task to an agent
   * @param {BackgroundTask} task - Task to assign
   * @param {BackgroundAgent} agent - Agent to assign to
   */
  async assignTaskToAgent(task, agent) {
    // Update agent status
    agent.status = 'busy';
    agent.lastActivity = new Date();
    agent.activeTasks.push(task);

    // Update task status
    this.updateTaskStatus(task.id, 'running');

    logger.info('BackgroundAgentManager', `Assigned task ${task.id} to agent ${agent.id}`);

    this.emit('task:assigned', { task, agent });

    try {
      // Execute task based on type
      const result = await this.executeTask(task, agent);

      // Update task completion
      this.updateTaskStatus(task.id, 'completed', null, result);

      // Update agent
      agent.status = 'idle';
      agent.lastActivity = new Date();
      agent.activeTasks = agent.activeTasks.filter(t => t.id !== task.id);

      this.emit('task:completed', { task, agent, result });

    } catch (error) {
      logger.error('BackgroundAgentManager', 'Task execution failed', {
        taskId: task.id,
        agentId: agent.id,
        error: error.message
      });

      // Update task failure
      this.updateTaskStatus(task.id, 'failed', error.message);

      // Update agent
      agent.status = 'error';
      agent.lastActivity = new Date();
      agent.activeTasks = agent.activeTasks.filter(t => t.id !== task.id);

      this.emit('task:failed', { task, agent, error });
    }
  }

  /**
   * Execute a task
   * @param {BackgroundTask} task - Task to execute
   * @param {BackgroundAgent} agent - Executing agent
   * @returns {Promise<any>} Task result
   */
  async executeTask(task, agent) {
    logger.debug('BackgroundAgentManager', `Executing task ${task.id}`, {
      type: task.type,
      agentType: agent.type
    });

    // Route to appropriate handler based on task type
    switch (task.type) {
      case 'cursor:create':
        return this.executeCursorCreateTask(task, agent);

      case 'cursor:followup':
        return this.executeCursorFollowupTask(task, agent);

      case 'webhook:process':
        return this.executeWebhookTask(task, agent);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Execute cursor creation task
   * @param {BackgroundTask} task - Task
   * @param {BackgroundAgent} agent - Agent
   * @returns {Promise<any>} Result
   */
  async executeCursorCreateTask(task, agent) {
    // Placeholder for cursor creation logic
    // Will be implemented with actual Cursor integration
    logger.info('BackgroundAgentManager', 'Executing cursor create task', {
      taskId: task.id,
      payload: task.payload
    });

    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      message: 'Cursor agent created (placeholder)',
      agentId: `cursor_${Date.now()}`
    };
  }

  /**
   * Execute cursor followup task
   * @param {BackgroundTask} task - Task
   * @param {BackgroundAgent} agent - Agent
   * @returns {Promise<any>} Result
   */
  async executeCursorFollowupTask(task, agent) {
    // Placeholder for cursor followup logic
    logger.info('BackgroundAgentManager', 'Executing cursor followup task', {
      taskId: task.id,
      payload: task.payload
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      message: 'Cursor followup sent (placeholder)'
    };
  }

  /**
   * Execute webhook task
   * @param {BackgroundTask} task - Task
   * @param {BackgroundAgent} agent - Agent
   * @returns {Promise<any>} Result
   */
  async executeWebhookTask(task, agent) {
    // Placeholder for webhook processing
    logger.info('BackgroundAgentManager', 'Executing webhook task', {
      taskId: task.id,
      payload: task.payload
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      message: 'Webhook processed (placeholder)'
    };
  }

  /**
   * Update task status
   * @param {string} taskId - Task ID
   * @param {'pending' | 'running' | 'completed' | 'failed'} status - New status
   * @param {string} [error] - Error message
   * @param {any} [result] - Task result
   */
  updateTaskStatus(taskId, status, error = null, result = null) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;

    if (status === 'running' && !task.startedAt) {
      task.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
    }

    if (error) {
      task.error = error;
    }

    if (result) {
      task.result = result;
    }

    this.emit('task:updated', task);
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {BackgroundTask|undefined} Task
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {BackgroundAgent|undefined} Agent
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get system status
   * @returns {Object} Status information
   */
  getStatus() {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    return {
      agents: {
        total: agents.length,
        idle: agents.filter(a => a.status === 'idle').length,
        busy: agents.filter(a => a.status === 'busy').length,
        error: agents.filter(a => a.status === 'error').length,
        stopped: agents.filter(a => a.status === 'stopped').length
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length
      },
      queue: {
        length: this.taskQueue.length
      }
    };
  }

  /**
   * Clean up old completed tasks
   */
  cleanup() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [taskId, task] of this.tasks) {
      if ((task.status === 'completed' || task.status === 'failed') &&
          task.completedAt && task.completedAt < cutoff) {
        this.tasks.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('BackgroundAgentManager', `Cleaned up ${cleanedCount} old tasks`);
    }
  }

  /**
   * Dispose manager
   */
  dispose() {
    this.stopProcessing();

    // Unregister all agents
    for (const agentId of this.agents.keys()) {
      this.unregisterAgent(agentId);
    }

    this.removeAllListeners();
  }
}

// Export singleton instance
export const backgroundAgentManager = new BackgroundAgentManager();