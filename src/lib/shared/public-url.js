/**
 * Public URL management for SvelteKit
 * Manages public base URL for tunnel/remote access
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { resolveDataPath } from './paths.js';

const RUNTIME_PATH = resolveDataPath('runtime', 'public-base-url.json');

/**
 * Ensure runtime directory exists
 */
function ensureDir() {
  const dir = dirname(RUNTIME_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Set the public base URL
 * @param {string | null} url - The public URL or null to clear
 */
export function setPublicBaseUrl(url) {
  ensureDir();
  const data = { url };
  writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2));
}

/**
 * Get the current public base URL
 * @returns {string | null} The current URL or null if not set
 */
export function getPublicBaseUrl() {
  try {
    const raw = readFileSync(RUNTIME_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.url ?? null;
  } catch {
    return null;
  }
}