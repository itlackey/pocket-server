import crypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { resolveDataPath } from '../shared/paths.js';

/**
 * @typedef {Object} PairingState
 * @property {boolean} active
 * @property {string} [pinHash] - sha256 of pin
 * @property {string} [startedAt] - ISO date string
 * @property {string} [expiresAt] - ISO date string
 */

const PAIRING_PATH = resolveDataPath('runtime', 'pairing.json');

/**
 * Ensure pairing state file exists
 */
function ensureStateFile() {
  const dir = dirname(PAIRING_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(PAIRING_PATH)) writeFileSync(PAIRING_PATH, JSON.stringify({ active: false }, null, 2), 'utf8');
}

/**
 * Get current pairing state
 * @returns {PairingState}
 */
export function getPairingState() {
  try {
    ensureStateFile();
    const raw = readFileSync(PAIRING_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data;
  } catch {
    return { active: false };
  }
}

/**
 * Save pairing state
 * @param {PairingState} state
 */
function savePairingState(state) {
  ensureStateFile();
  writeFileSync(PAIRING_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Start a pairing window
 * @param {number} [durationMs=60000] - Duration in milliseconds
 * @param {string} [pin] - Optional PIN override
 * @returns {{ pin: string; expiresAt: string }}
 */
export function startPairingWindow(durationMs = 60_000, pin) {
  const generated = typeof pin === 'string' && pin.length === 6 ? pin : String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const pinHash = crypto.createHash('sha256').update(generated).digest('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + durationMs);
  const state = {
    active: true,
    pinHash,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  savePairingState(state);
  return { pin: generated, expiresAt: state.expiresAt };
}

/**
 * Stop the pairing window
 */
export function stopPairingWindow() {
  savePairingState({ active: false });
}

/**
 * Check if pairing is currently active
 * @returns {boolean}
 */
export function isPairingActive() {
  const s = getPairingState();
  if (!s.active) return false;
  if (!s.expiresAt) return false;
  return Date.now() < new Date(s.expiresAt).getTime();
}

/**
 * Verify a PIN against current pairing state
 * @param {string} pin
 * @returns {boolean}
 */
export function verifyPin(pin) {
  const s = getPairingState();
  if (!s.active || !s.pinHash || !s.expiresAt) return false;
  if (Date.now() >= new Date(s.expiresAt).getTime()) return false;
  const hash = crypto.createHash('sha256').update(pin).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(s.pinHash, 'hex'));
}