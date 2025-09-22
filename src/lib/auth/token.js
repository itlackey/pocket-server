/**
 * Token verification and management
 * @file token.js
 */

import crypto from 'crypto';

/**
 * Verify access token
 * @param {string} token - The token to verify
 * @returns {Promise<{deviceId: string} | null>} Token payload or null if invalid
 */
export async function verifyAccessToken(token) {
  try {
    // For now, implement a simple token verification
    // In a full implementation, this would verify JWT or similar
    
    // Check if token looks like a valid format
    if (!token || token.length < 16) {
      return null;
    }
    
    // For demo purposes, extract deviceId from token
    // Real implementation would verify signature
    // Token format: {deviceId}-{randomPart}
    // DeviceId can contain hyphens, so find the last hyphen
    const lastHyphenIndex = token.lastIndexOf('-');
    if (lastHyphenIndex > 0 && lastHyphenIndex < token.length - 1) {
      const deviceId = token.substring(0, lastHyphenIndex);
      return { deviceId };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate access token for device
 * @param {string} deviceId - Device ID
 * @returns {string} Generated token
 */
export function generateAccessToken(deviceId) {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `${deviceId}-${randomPart}`;
}