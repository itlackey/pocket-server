/**
 * Cursor Agent Store
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Local persistent storage for Cursor cloud agent records
 *
 * @fileoverview File-based storage for Cursor agent data
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '$lib/shared/logger.js';

/**
 * @typedef {import('./types.js').CloudAgentRecord} CloudAgentRecord
 */

const DATA_DIR = join(process.cwd(), 'data', 'cloud-agents');
const INDEX_PATH = join(DATA_DIR, 'index.json');

/**
 * Ensure store directory and index file exist
 */
function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(INDEX_PATH)) {
    writeFileSync(INDEX_PATH, JSON.stringify({ agents: [] }, null, 2));
  }
}

/**
 * Upsert a cloud agent record
 * @param {CloudAgentRecord} record - Agent record to upsert
 */
export function upsertRecord(record) {
  ensureStore();

  try {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const existingIdx = index.agents.findIndex(a => a.id === record.id);

    const merged = existingIdx >= 0
      ? { ...index.agents[existingIdx], ...record, updatedAt: new Date().toISOString() }
      : { ...record, updatedAt: new Date().toISOString() };

    if (existingIdx >= 0) {
      index.agents[existingIdx] = merged;
    } else {
      index.agents.unshift(merged);
    }

    writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

    const itemPath = join(DATA_DIR, `${record.id}.json`);
    // Write the merged record so fields like ownerClientId are preserved
    writeFileSync(itemPath, JSON.stringify(merged, null, 2));

    logger.debug('CursorStore', 'Record upserted', { id: record.id });

  } catch (error) {
    logger.error('CursorStore', 'Failed to upsert record', {
      id: record.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get a cloud agent record by ID
 * @param {string} id - Agent ID
 * @returns {CloudAgentRecord | undefined} Agent record or undefined
 */
export function getRecord(id) {
  ensureStore();

  try {
    const itemPath = join(DATA_DIR, `${id}.json`);
    const raw = readFileSync(itemPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    logger.debug('CursorStore', 'Record not found', { id });
    return undefined;
  }
}

/**
 * List cloud agent records with pagination
 * @param {number} [limit] - Maximum number of records to return
 * @param {string} [cursor] - Pagination cursor (agent ID)
 * @returns {{items: CloudAgentRecord[], nextCursor?: string}} Paginated results
 */
export function listRecords(limit = 20, cursor) {
  ensureStore();

  try {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const start = cursor ? Math.max(index.agents.findIndex(a => a.id === cursor), 0) + 1 : 0;
    const items = index.agents.slice(start, start + limit);
    const nextCursor = start + limit < index.agents.length ? items[items.length - 1]?.id : undefined;

    logger.debug('CursorStore', 'Listed records', {
      total: index.agents.length,
      returned: items.length,
      start,
      hasNext: !!nextCursor
    });

    return { items, nextCursor };
  } catch (error) {
    logger.error('CursorStore', 'Failed to list records', { error: error.message });
    throw error;
  }
}

/**
 * Delete a cloud agent record
 * @param {string} id - Agent ID
 * @returns {boolean} Whether record was deleted
 */
export function deleteRecord(id) {
  ensureStore();

  try {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const existingIdx = index.agents.findIndex(a => a.id === id);

    if (existingIdx >= 0) {
      index.agents.splice(existingIdx, 1);
      writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

      // Delete individual file
      try {
        const itemPath = join(DATA_DIR, `${id}.json`);
        if (existsSync(itemPath)) {
          require('fs').unlinkSync(itemPath);
        }
      } catch (e) {
        logger.warn('CursorStore', 'Failed to delete individual file', {
          id,
          error: e.message
        });
      }

      logger.info('CursorStore', 'Record deleted', { id });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('CursorStore', 'Failed to delete record', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get store statistics
 * @returns {Object} Store statistics
 */
export function getStoreStats() {
  ensureStore();

  try {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const agents = index.agents || [];

    const stats = {
      total: agents.length,
      byStatus: {},
      recent: agents.slice(0, 5).map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        updatedAt: a.updatedAt
      }))
    };

    // Count by status
    for (const agent of agents) {
      stats.byStatus[agent.status] = (stats.byStatus[agent.status] || 0) + 1;
    }

    return stats;
  } catch (error) {
    logger.error('CursorStore', 'Failed to get stats', { error: error.message });
    return {
      total: 0,
      byStatus: {},
      recent: []
    };
  }
}

/**
 * Clear all records (for testing)
 */
export function clearStore() {
  ensureStore();

  try {
    writeFileSync(INDEX_PATH, JSON.stringify({ agents: [] }, null, 2));

    // Delete all individual files
    const files = require('fs').readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'index.json') {
        require('fs').unlinkSync(join(DATA_DIR, file));
      }
    }

    logger.info('CursorStore', 'Store cleared');
  } catch (error) {
    logger.error('CursorStore', 'Failed to clear store', { error: error.message });
    throw error;
  }
}