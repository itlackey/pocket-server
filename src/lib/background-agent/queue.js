/**
 * Background Agent Queue System
 * Task queue implementation with priority and retry logic
 *
 * @fileoverview Background task queue with advanced scheduling
 */

import { logger } from '$lib/shared/logger.js';
import { EventEmitter } from 'events';

/**
 * @typedef {Object} QueuedTask
 * @property {string} id - Task ID
 * @property {string} type - Task type
 * @property {any} payload - Task payload
 * @property {number} priority - Task priority (higher = more important)
 * @property {number} maxRetries - Maximum retry attempts
 * @property {number} retryCount - Current retry count
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [scheduledAt] - When task should be executed
 * @property {Date} [lastAttempt] - Last execution attempt
 * @property {string[]} errors - Error history
 * @property {Object} [metadata] - Additional task metadata
 */

/**
 * @typedef {Object} QueueOptions
 * @property {number} [maxConcurrent] - Max concurrent tasks
 * @property {number} [defaultPriority] - Default task priority
 * @property {number} [defaultMaxRetries] - Default max retries
 * @property {number} [retryDelay] - Base retry delay in ms
 * @property {number} [maxRetryDelay] - Maximum retry delay in ms
 */

/**
 * Background Agent Queue
 * Manages task queuing with priority and retry logic
 */
export class BackgroundAgentQueue extends EventEmitter {
  /**
   * @param {QueueOptions} [options] - Queue configuration
   */
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrent: 5,
      defaultPriority: 5,
      defaultMaxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      ...options
    };

    /** @type {QueuedTask[]} */
    this.queue = [];

    /** @type {Set<string>} */
    this.runningTasks = new Set();

    /** @type {Map<string, QueuedTask>} */
    this.tasks = new Map();

    /** @type {NodeJS.Timeout|null} */
    this.processInterval = null;

    this.startProcessing();
  }

  /**
   * Start queue processing
   */
  startProcessing() {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Check every second

    logger.info('BackgroundAgentQueue', 'Started processing');
  }

  /**
   * Stop queue processing
   */
  stopProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    logger.info('BackgroundAgentQueue', 'Stopped processing');
  }

  /**
   * Add task to queue
   * @param {string} type - Task type
   * @param {any} payload - Task payload
   * @param {Object} [options] - Task options
   * @param {number} [options.priority] - Task priority
   * @param {number} [options.maxRetries] - Max retry attempts
   * @param {Date} [options.scheduledAt] - Scheduled execution time
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {QueuedTask} Queued task
   */
  add(type, payload, options = {}) {
    const task = {
      id: crypto.randomUUID(),
      type,
      payload,
      priority: options.priority ?? this.options.defaultPriority,
      maxRetries: options.maxRetries ?? this.options.defaultMaxRetries,
      retryCount: 0,
      createdAt: new Date(),
      scheduledAt: options.scheduledAt,
      errors: [],
      metadata: options.metadata || {}
    };

    this.tasks.set(task.id, task);
    this.queue.push(task);

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    logger.debug('BackgroundAgentQueue', `Task added: ${task.id}`, {
      type,
      priority: task.priority,
      queueLength: this.queue.length
    });

    this.emit('task:added', task);
    return task;
  }

  /**
   * Process the queue
   */
  async processQueue() {
    // Check if we can process more tasks
    if (this.runningTasks.size >= this.options.maxConcurrent) {
      return;
    }

    // Find next task to process
    const availableSlots = this.options.maxConcurrent - this.runningTasks.size;
    const tasksToProcess = [];

    for (let i = 0; i < this.queue.length && tasksToProcess.length < availableSlots; i++) {
      const task = this.queue[i];

      // Check if task is scheduled for future execution
      if (task.scheduledAt && task.scheduledAt > new Date()) {
        continue;
      }

      // Check if task is already running
      if (this.runningTasks.has(task.id)) {
        continue;
      }

      tasksToProcess.push(task);
    }

    // Process selected tasks
    for (const task of tasksToProcess) {
      this.processTask(task);
    }
  }

  /**
   * Process a single task
   * @param {QueuedTask} task - Task to process
   */
  async processTask(task) {
    // Remove from queue and add to running
    const queueIndex = this.queue.findIndex(t => t.id === task.id);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    this.runningTasks.add(task.id);
    task.lastAttempt = new Date();

    logger.debug('BackgroundAgentQueue', `Processing task: ${task.id}`, {
      type: task.type,
      attempt: task.retryCount + 1
    });

    this.emit('task:started', task);

    try {
      // Execute task through the handler
      const result = await this.executeTask(task);

      // Task completed successfully
      this.runningTasks.delete(task.id);
      this.tasks.delete(task.id);

      logger.info('BackgroundAgentQueue', `Task completed: ${task.id}`, {
        type: task.type,
        duration: Date.now() - task.lastAttempt.getTime()
      });

      this.emit('task:completed', { task, result });

    } catch (error) {
      // Task failed
      this.runningTasks.delete(task.id);
      task.retryCount++;
      task.errors.push(error.message);

      logger.warn('BackgroundAgentQueue', `Task failed: ${task.id}`, {
        type: task.type,
        attempt: task.retryCount,
        error: error.message
      });

      if (task.retryCount < task.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.min(
          this.options.retryDelay * Math.pow(2, task.retryCount - 1),
          this.options.maxRetryDelay
        );

        task.scheduledAt = new Date(Date.now() + delay);
        this.queue.push(task);

        // Resort queue
        this.queue.sort((a, b) => b.priority - a.priority);

        logger.info('BackgroundAgentQueue', `Task scheduled for retry: ${task.id}`, {
          delay,
          attempt: task.retryCount + 1,
          maxRetries: task.maxRetries
        });

        this.emit('task:retry', { task, delay });

      } else {
        // Max retries exceeded
        this.tasks.delete(task.id);

        logger.error('BackgroundAgentQueue', `Task failed permanently: ${task.id}`, {
          type: task.type,
          retries: task.retryCount,
          errors: task.errors
        });

        this.emit('task:failed', { task, error });
      }
    }
  }

  /**
   * Execute a task (to be overridden or handled by external executor)
   * @param {QueuedTask} task - Task to execute
   * @returns {Promise<any>} Task result
   */
  async executeTask(task) {
    // Default implementation - should be overridden
    this.emit('task:execute', task);

    // Wait for external execution
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task execution timeout'));
      }, 30000); // 30 second timeout

      // Listen for task completion
      const onResult = (result) => {
        clearTimeout(timeout);
        this.removeListener(`task:result:${task.id}`, onResult);
        this.removeListener(`task:error:${task.id}`, onError);
        resolve(result);
      };

      const onError = (error) => {
        clearTimeout(timeout);
        this.removeListener(`task:result:${task.id}`, onResult);
        this.removeListener(`task:error:${task.id}`, onError);
        reject(error);
      };

      this.once(`task:result:${task.id}`, onResult);
      this.once(`task:error:${task.id}`, onError);
    });
  }

  /**
   * Complete a task execution
   * @param {string} taskId - Task ID
   * @param {any} result - Task result
   */
  completeTask(taskId, result) {
    this.emit(`task:result:${taskId}`, result);
  }

  /**
   * Fail a task execution
   * @param {string} taskId - Task ID
   * @param {Error} error - Task error
   */
  failTask(taskId, error) {
    this.emit(`task:error:${taskId}`, error);
  }

  /**
   * Cancel a task
   * @param {string} taskId - Task ID
   * @returns {boolean} Whether task was cancelled
   */
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Remove from queue
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    // Remove from running
    this.runningTasks.delete(taskId);

    // Remove from tasks
    this.tasks.delete(taskId);

    logger.info('BackgroundAgentQueue', `Task cancelled: ${taskId}`);
    this.emit('task:cancelled', task);

    return true;
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {QueuedTask|undefined} Task
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    const tasks = Array.from(this.tasks.values());

    return {
      queue: {
        length: this.queue.length,
        running: this.runningTasks.size,
        maxConcurrent: this.options.maxConcurrent
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => !this.runningTasks.has(t.id)).length,
        running: this.runningTasks.size,
        retrying: tasks.filter(t => t.retryCount > 0 && !this.runningTasks.has(t.id)).length
      },
      options: this.options
    };
  }

  /**
   * Clear all tasks
   */
  clear() {
    this.queue.length = 0;
    this.runningTasks.clear();
    this.tasks.clear();

    logger.info('BackgroundAgentQueue', 'Queue cleared');
    this.emit('queue:cleared');
  }

  /**
   * Dispose queue
   */
  dispose() {
    this.stopProcessing();
    this.clear();
    this.removeAllListeners();
  }
}

// Export default queue instance
export const backgroundQueue = new BackgroundAgentQueue();