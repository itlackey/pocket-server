/**
 * Cursor API Client
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview Client for Cursor API integration
 */

import { logger } from '$lib/shared/logger.js';

/**
 * @typedef {import('./types.js').CreateAgentInput} CreateAgentInput
 * @typedef {import('./types.js').CursorAgentMinimal} CursorAgentMinimal
 * @typedef {import('./types.js').CursorConversationResponse} CursorConversationResponse
 * @typedef {import('./types.js').CursorListAgentsResponse} CursorListAgentsResponse
 */

const CURSOR_BASE = 'https://api.cursor.com/v0';

/**
 * Sanitize request body for logging (remove sensitive data)
 * @param {unknown} body - Request body
 * @returns {unknown} Sanitized body
 */
function sanitizeBodyForLog(body) {
  try {
    const obj = typeof body === 'string' ? JSON.parse(body) : body;
    if (!obj || typeof obj !== 'object') return obj;
    const clone = JSON.parse(JSON.stringify(obj));

    // Redact webhook secrets if present
    if (clone?.webhook?.secret) {
      clone.webhook.secret = '[redacted]';
    }

    if (clone?.prompt?.images && Array.isArray(clone.prompt.images)) {
      clone.prompt.images = clone.prompt.images.map((img) => ({
        dataLen: img?.data ? String(img.data).length : 0,
        dimension: img?.dimension,
      }));
    }

    if (clone?.prompt?.text) {
      const txt = String(clone.prompt.text);
      clone.prompt.text = txt.length > 500 ? `${txt.slice(0, 500)}…` : txt;
    }

    return clone;
  } catch {
    return undefined;
  }
}

/**
 * Log response for debugging
 * @param {string} url - Request URL
 * @param {'Bearer' | 'Basic'} auth - Auth type
 * @param {Response} res - Response object
 */
async function logResponseForDebug(url, auth, res) {
  try {
    const clone = res.clone();
    const text = await clone.text();
    const snippet = text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
    logger.info('Cursor', 'http_response', { url, auth, status: res.status, body: snippet });
  } catch {}
}

/**
 * Fetch with authentication headers
 * @param {string} apiKey - Cursor API key
 * @param {RequestInfo | URL} input - Request input
 * @param {RequestInit} init - Request init
 * @returns {Promise<Response>} Response
 */
async function fetchWithAuth(apiKey, input, init) {
  const urlStr = typeof input === 'string' ? input : input.toString();
  const sanitized = sanitizeBodyForLog(init.body);

  // Provide both Authorization and x-cursor-api-key headers for compatibility
  // Some Cursor endpoints expect x-cursor-api-key; others may accept Bearer
  const authInit = {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${apiKey}`,
      'x-cursor-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'pocket-server/1.0',
    },
  };

  // Extra diagnostics (do NOT log full keys)
  try {
    logger.info('Cursor', 'auth_debug', {
      hasAuthorization: !!(authInit.headers).Authorization,
      hasXCursorApiKey: !!(authInit.headers)['x-cursor-api-key'],
      tokenPrefix: `${apiKey.slice(0, 6)}...`,
      tokenLength: apiKey.length,
    });
  } catch {}

  logger.info('Cursor', 'http_request', {
    url: urlStr,
    method: init.method || 'GET',
    auth: 'Bearer+x-cursor-api-key',
    body: sanitized
  });

  const res = await fetch(input, authInit);
  await logResponseForDebug(urlStr, 'Bearer', res);

  return res;
}

/**
 * Create a new Cursor agent
 * @param {string} apiKey - API key
 * @param {CreateAgentInput} input - Agent creation input
 * @returns {Promise<CursorAgentMinimal>} Created agent
 */
export async function createAgent(apiKey, input) {
  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/agents`, {
    method: 'POST',
    body: JSON.stringify({ ...input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_create_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * Add followup message to agent
 * @param {string} apiKey - API key
 * @param {string} id - Agent ID
 * @param {string} text - Followup text
 * @param {Array<{data: string, dimension?: {width: number, height: number}}>} [images] - Optional images
 * @returns {Promise<{id: string}>} Response
 */
export async function addFollowup(apiKey, id, text, images) {
  const payload = { text };
  if (images && images.length > 0) {
    payload.images = images;
  }

  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/agents/${id}/followup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_followup_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * List agents
 * @param {string} apiKey - API key
 * @param {number} [limit] - Result limit
 * @param {string} [cursor] - Pagination cursor
 * @returns {Promise<CursorListAgentsResponse>} Agents list
 */
export async function listAgents(apiKey, limit = 50, cursor) {
  const url = new URL(`${CURSOR_BASE}/agents`);
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetchWithAuth(apiKey, url, { method: 'GET' });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_list_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * Get agent conversation
 * @param {string} apiKey - API key
 * @param {string} id - Agent ID
 * @returns {Promise<CursorConversationResponse>} Conversation
 */
export async function getConversation(apiKey, id) {
  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/agents/${id}/conversation`, { method: 'GET' });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409 && text && text.toLowerCase().includes('agent is deleted')) {
      throw new Error('cursor_conv_deleted');
    }
    throw new Error(`cursor_conv_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * Delete agent
 * @param {string} apiKey - API key
 * @param {string} id - Agent ID
 * @returns {Promise<{id: string}>} Deletion response
 */
export async function deleteAgent(apiKey, id) {
  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/agents/${id}`, { method: 'DELETE' });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_delete_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * Get current user info
 * @param {string} apiKey - API key
 * @returns {Promise<{apiKeyName: string, createdAt: string, userEmail?: string}>} User info
 */
export async function getMe(apiKey) {
  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/me`, { method: 'GET' });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_me_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}

/**
 * List available models
 * @param {string} apiKey - API key
 * @returns {Promise<{models: string[]}>} Available models
 */
export async function listModels(apiKey) {
  const res = await fetchWithAuth(apiKey, `${CURSOR_BASE}/models`, { method: 'GET' });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cursor_models_failed status=${res.status} body=${text}`);
  }

  return await res.json();
}