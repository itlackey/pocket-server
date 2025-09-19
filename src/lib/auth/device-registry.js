import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { resolveDataPath } from '../shared/paths.js';

/**
 * @typedef {Object} RegisteredDevice
 * @property {string} deviceId
 * @property {string} secret - per-device secret for client proof
 * @property {string} [platform]
 * @property {string} [name]
 * @property {string} createdAt - ISO date string
 * @property {string} [lastSeen] - ISO date string
 * @property {boolean} [revoked]
 */

const DEVICES_PATH = resolveDataPath('auth', 'devices.json');

/**
 * Ensure registry file exists
 */
function ensureRegistry() {
  const dir = dirname(DEVICES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(DEVICES_PATH)) writeFileSync(DEVICES_PATH, JSON.stringify([], null, 2), 'utf8');
}

/**
 * Load all devices from registry
 * @returns {RegisteredDevice[]}
 */
export function loadDevices() {
  try {
    ensureRegistry();
    const raw = readFileSync(DEVICES_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Save devices to registry
 * @param {RegisteredDevice[]} devices
 */
function saveDevices(devices) {
  ensureRegistry();
  writeFileSync(DEVICES_PATH, JSON.stringify(devices, null, 2), 'utf8');
}

/**
 * Get a device by ID
 * @param {string} deviceId
 * @returns {RegisteredDevice | undefined}
 */
export function getDevice(deviceId) {
  const devices = loadDevices();
  return devices.find((d) => d.deviceId === deviceId);
}

/**
 * Create or update a device
 * @param {Omit<RegisteredDevice, 'createdAt'> & { createdAt?: string }} input
 * @returns {RegisteredDevice}
 */
export function upsertDevice(input) {
  const devices = loadDevices();
  const now = new Date().toISOString();
  const idx = devices.findIndex((d) => d.deviceId === input.deviceId);
  const toSave = {
    deviceId: input.deviceId,
    secret: input.secret,
    platform: input.platform,
    name: input.name,
    createdAt: input.createdAt || now,
    lastSeen: now,
    revoked: input.revoked,
  };
  if (idx >= 0) devices[idx] = { ...devices[idx], ...toSave };
  else devices.push(toSave);
  saveDevices(devices);
  return toSave;
}

/**
 * Update last seen timestamp for a device
 * @param {string} deviceId
 */
export function updateLastSeen(deviceId) {
  const devices = loadDevices();
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx].lastSeen = new Date().toISOString();
    saveDevices(devices);
  }
}

/**
 * Revoke a device
 * @param {string} deviceId
 * @returns {boolean} True if device was found and revoked
 */
export function revokeDevice(deviceId) {
  const devices = loadDevices();
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx].revoked = true;
    saveDevices(devices);
    return true;
  }
  return false;
}