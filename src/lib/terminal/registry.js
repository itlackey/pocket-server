/**
 * Terminal Registry
 * Tracks terminal session metadata
 */

import { logger } from '../shared/logger.js';

/**
 * @typedef {import('./types.js').TerminalRegistryEntry} TerminalRegistryEntry
 */

export class TerminalRegistry {
  constructor() {
    /** @type {Map<string, TerminalRegistryEntry>} */
    this.entries = new Map();
  }

  /**
   * Upsert terminal registry entry
   * @param {Partial<TerminalRegistryEntry> & {id: string}} data - Terminal data
   */
  upsert(data) {
    const existing = this.entries.get(data.id);
    const entry = {
      id: data.id,
      title: data.title || existing?.title || `Terminal ${data.id}`,
      cwd: data.cwd || existing?.cwd || process.cwd(),
      cols: data.cols || existing?.cols || 80,
      rows: data.rows || existing?.rows || 24,
      active: data.active !== undefined ? data.active : existing?.active || true,
      createdAt: existing?.createdAt || data.createdAt || new Date().toISOString(),
      ownerClientId: data.ownerClientId || existing?.ownerClientId,
      ownerDeviceId: data.ownerDeviceId || existing?.ownerDeviceId,
      lastAttachedAt: data.lastAttachedAt || existing?.lastAttachedAt || new Date().toISOString()
    };

    this.entries.set(data.id, entry);
    logger.terminal('registry_upsert', data.id, entry);
  }

  /**
   * Get terminal registry entry
   * @param {string} id - Terminal ID
   * @returns {TerminalRegistryEntry | undefined}
   */
  get(id) {
    return this.entries.get(id);
  }

  /**
   * Remove terminal from registry
   * @param {string} id - Terminal ID
   */
  remove(id) {
    if (this.entries.delete(id)) {
      logger.terminal('registry_removed', id);
    }
  }

  /**
   * Set terminal title
   * @param {string} id - Terminal ID
   * @param {string} title - New title
   */
  setTitle(id, title) {
    const entry = this.entries.get(id);
    if (entry) {
      entry.title = title;
      this.entries.set(id, entry);
      logger.terminal('title_updated', id, { title });
    }
  }

  /**
   * List all terminal entries
   * @returns {TerminalRegistryEntry[]}
   */
  list() {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries.clear();
    logger.terminal('registry_cleared');
  }
}