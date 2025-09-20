/**
 * Local WebSocket secret management
 * @file local-ws.js
 */

import nodeCrypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { resolveDataPath } from '../shared/paths.js';

const LOCAL_WS_KEY_PATH = resolveDataPath('runtime', 'local-ws.key');

/**
 * Ensure the directory exists
 */
function ensureDir() {
  const dir = dirname(LOCAL_WS_KEY_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Get or create local WebSocket secret
 * @returns {string} The local WebSocket secret
 */
export function getOrCreateLocalWsSecret() {
  ensureDir();
  if (!existsSync(LOCAL_WS_KEY_PATH)) {
    const buf = nodeCrypto.randomBytes(32);
    const token = buf.toString('base64url');
    writeFileSync(LOCAL_WS_KEY_PATH, token, 'utf8');
    try { 
      globalThis.__POCKET_LOCAL_WS_SECRET = token; 
    } catch {}
    return token;
  }
  
  try {
    const raw = readFileSync(LOCAL_WS_KEY_PATH, 'utf8').trim();
    globalThis.__POCKET_LOCAL_WS_SECRET = raw;
    return raw;
  } catch {
    const buf = nodeCrypto.randomBytes(32);
    const token = buf.toString('base64url');
    writeFileSync(LOCAL_WS_KEY_PATH, token, 'utf8');
    try { 
      globalThis.__POCKET_LOCAL_WS_SECRET = token; 
    } catch {}
    return token;
  }
}

/**
 * Get cached local WebSocket secret
 * @returns {string | null} The cached secret or null
 */
export function getLocalWsSecretFast() {
  const cached = globalThis.__POCKET_LOCAL_WS_SECRET;
  return cached || null;
}