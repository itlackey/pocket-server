/**
 * Authentication middleware for API routes
 * @file middleware.js
 */

import { getDevice, updateLastSeen } from './device-registry.js';
import { verifyAccessToken } from './token.js';

/**
 * Verify authentication from request headers
 * @param {Request} req - Request object
 * @returns {Promise<{ok: true, deviceId: string} | {ok: false, status: number, reason: string}>}
 */
export async function verifyAuthFromRequest(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Pocket ')) {
    return { ok: false, status: 401, reason: 'missing_token' };
  }
  
  const token = auth.slice('Pocket '.length).trim();
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { ok: false, status: 401, reason: 'invalid_token' };
  }
  
  const device = getDevice(payload.deviceId);
  if (!device || device.revoked) {
    return { ok: false, status: 401, reason: 'device_unregistered' };
  }
  
  try { 
    updateLastSeen(payload.deviceId); 
  } catch {}
  
  return { ok: true, deviceId: payload.deviceId };
}

/**
 * Check if request is from local network
 * @param {Request} req - Request object
 * @param {string | null} [publicHost] - Known public host
 * @returns {boolean}
 */
export function isLocalRequest(req, publicHost = null) {
  try {
    const url = new URL(req.url);
    const host = url.hostname;
    
    // If request Host matches known public host, treat as non-local
    if (publicHost && publicHost.includes(host)) return false;
    
    // RFC1918 ranges and localhost
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.startsWith('10.')) return true;
    
    const parts = host.split('.');
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    
    return false;
  } catch {
    return false;
  }
}