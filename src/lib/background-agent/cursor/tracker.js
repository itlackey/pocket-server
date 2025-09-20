/**
 * Cursor Agent Tracker
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Single orchestrator for polling Cursor safely and pushing WS updates.
 *
 * @fileoverview Cursor agent tracking and polling system
 */

import { logger } from '$lib/shared/logger.js';
import { wsManager } from '$lib/websocket.js';

/**
 * @typedef {import('./types.js').CursorAgentMinimal} CursorAgentMinimal
 * @typedef {import('./types.js').CursorConversationResponse} CursorConversationResponse
 */

/**
 * @typedef {Object} TrackedAgent
 * @property {string} id - Agent ID
 * @property {string} apiKey - API key
 * @property {string} [lastStatus] - Last known status
 * @property {CursorAgentMinimal} [lastAgent] - Last agent data
 * @property {CursorConversationResponse} [conversation] - Conversation data
 * @property {number} nextPollAt - Next poll timestamp
 */

/**
 * @typedef {Object} CompletedAgent
 * @property {CursorAgentMinimal} agent - Completed agent
 * @property {CursorConversationResponse} [conversation] - Final conversation
 * @property {number} expiresAt - Expiration timestamp
 */

/**
 * Cursor Agent Tracker
 * Manages polling and tracking of Cursor agents
 */
class CursorAgentTracker {
  constructor() {
    /** @type {Map<string, TrackedAgent>} */
    this.tracked = new Map();

    /** @type {Map<string, CompletedAgent>} */
    this.completed = new Map();

    /** @type {NodeJS.Timeout|null} */
    this.timer = null;

    /** @type {number} */
    this.POLL_MS = 8000; // status cadence

    /** @type {number} */
    this.COMPLETED_TTL_MS = 15 * 60 * 1000; // 15m
  }

  /**
   * Start tracking
   */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
    logger.info('CursorTracker', 'Started tracking');
  }

  /**
   * Stop tracking
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('CursorTracker', 'Stopped tracking');
  }

  /**
   * Track an agent
   * @param {string} id - Agent ID
   * @param {string} apiKey - API key
   */
  track(id, apiKey) {
    const existing = this.tracked.get(id);
    if (existing) {
      // update apiKey if changed
      if (apiKey && existing.apiKey !== apiKey) existing.apiKey = apiKey;
      return;
    }

    // If this agent was previously marked completed, clear the cached snapshot
    if (this.completed.has(id)) {
      this.completed.delete(id);
    }

    this.tracked.set(id, {
      id,
      apiKey,
      nextPollAt: Date.now(),
    });

    this.start();
    logger.info('CursorTracker', 'track', { id });
  }

  /**
   * Ensure agents are tracked
   * @param {CursorAgentMinimal[]} agents - Agents to track
   * @param {string} apiKey - API key
   */
  ensureTracked(agents, apiKey) {
    agents.forEach(a => {
      if (a.status === 'CREATING' || a.status === 'RUNNING') {
        this.track(a.id, apiKey);
      }
    });
  }

  /**
   * Untrack an agent
   * @param {string} id - Agent ID
   */
  untrack(id) {
    this.tracked.delete(id);
    logger.info('CursorTracker', 'untrack', { id });
  }

  /**
   * Get agent snapshot
   * @param {string} id - Agent ID
   * @returns {{agent?: CursorAgentMinimal, conversation?: CursorConversationResponse} | null} Snapshot
   */
  getSnapshot(id) {
    // Prefer live tracked state if available
    const t = this.tracked.get(id);
    if (t && (t.lastAgent || t.conversation)) {
      return { agent: t.lastAgent, conversation: t.conversation };
    }

    // Fallback to completed snapshot
    const done = this.completed.get(id);
    if (done) return { agent: done.agent, conversation: done.conversation };

    return null;
  }

  /**
   * Polling tick
   */
  async tick() {
    const now = Date.now();

    // Clean up expired completed agents
    for (const [id, completed] of this.completed) {
      if (completed.expiresAt < now) {
        this.completed.delete(id);
      }
    }

    for (const t of this.tracked.values()) {
      if (t.nextPollAt > now) continue;

      // schedule next status poll
      t.nextPollAt = now + this.POLL_MS;

      try {
        // Import client functions dynamically to avoid circular dependencies
        const { getAgent, getConversation } = await import('./client.js');

        const agent = await getAgent(t.apiKey, t.id);
        const statusChanged = agent.status !== t.lastStatus;
        t.lastStatus = agent.status;
        t.lastAgent = agent;

        if (statusChanged) {
          // Broadcast status change via WebSocket
          wsManager.broadcast({
            v: 1,
            id: crypto.randomUUID(),
            sessionId: 'cloud',
            ts: new Date().toISOString(),
            seq: 0,
            type: 'cursor:status',
            payload: {
              id: agent.id,
              status: agent.status,
              agent: agent,
            },
          });

          logger.info('CursorTracker', 'status_change', {
            id: agent.id,
            status: agent.status,
            previous: t.lastStatus
          });

          // Send notification for status changes
          try {
            const { notificationsService } = await import('$lib/notifications/service.js');
            await notificationsService.sendNotification({
              title: `Cursor Agent ${agent.status}`,
              body: `Agent ${agent.name} is now ${agent.status.toLowerCase()}`,
              data: { agentId: agent.id, status: agent.status }
            });
          } catch (e) {
            // Notifications service might not be available
            logger.debug('CursorTracker', 'notification_failed', { error: e.message });
          }
        }

        // Fetch conversation for completed agents
        if (agent.status === 'FINISHED' || agent.status === 'ERROR') {
          try {
            const conversation = await getConversation(t.apiKey, t.id);
            t.conversation = conversation;

            // Move to completed cache
            this.completed.set(t.id, {
              agent,
              conversation,
              expiresAt: now + this.COMPLETED_TTL_MS
            });

            // Stop tracking
            this.untrack(t.id);

            // Broadcast final conversation
            wsManager.broadcast({
              v: 1,
              id: crypto.randomUUID(),
              sessionId: 'cloud',
              ts: new Date().toISOString(),
              seq: 0,
              type: 'cursor:conversation',
              payload: {
                id: agent.id,
                conversation: conversation,
              },
            });

            logger.info('CursorTracker', 'agent_completed', {
              id: agent.id,
              status: agent.status,
              messageCount: conversation.messages?.length || 0
            });

          } catch (convError) {
            // Sometimes conversation isn't available immediately
            logger.warn('CursorTracker', 'conversation_fetch_failed', {
              id: t.id,
              error: convError.message
            });

            // If conversation fetch fails, still move to completed
            this.completed.set(t.id, {
              agent,
              expiresAt: now + this.COMPLETED_TTL_MS
            });

            this.untrack(t.id);
          }
        }

      } catch (error) {
        logger.warn('CursorTracker', 'poll_failed', {
          id: t.id,
          error: error.message
        });

        // If error indicates agent doesn't exist, stop tracking
        if (error.message.includes('404') || error.message.includes('not found')) {
          logger.info('CursorTracker', 'agent_not_found', { id: t.id });
          this.untrack(t.id);
        }
      }
    }

    // Stop timer if no agents to track
    if (this.tracked.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.debug('CursorTracker', 'stopped_timer');
    }
  }

  /**
   * Get tracking status
   * @returns {Object} Tracking status
   */
  getStatus() {
    return {
      tracked: this.tracked.size,
      completed: this.completed.size,
      isRunning: !!this.timer,
      agents: {
        tracked: Array.from(this.tracked.values()).map(t => ({
          id: t.id,
          lastStatus: t.lastStatus,
          nextPollAt: new Date(t.nextPollAt).toISOString()
        })),
        completed: Array.from(this.completed.entries()).map(([id, c]) => ({
          id,
          status: c.agent.status,
          expiresAt: new Date(c.expiresAt).toISOString()
        }))
      }
    };
  }

  /**
   * Dispose tracker
   */
  dispose() {
    this.stop();
    this.tracked.clear();
    this.completed.clear();
  }
}

// Export singleton instance
export const cursorAgentTracker = new CursorAgentTracker();