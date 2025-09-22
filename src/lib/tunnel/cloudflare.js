/**
 * Cloudflare Tunnel Integration
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Cloudflare tunnel integration for remote access
 *
 * @fileoverview Cloudflare tunnel management for public URL access
 */

import { spawn } from 'child_process';
import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '$lib/shared/logger.js';
import { getPublicBaseUrl as getCurrentPublicUrl, setPublicBaseUrl } from '$lib/shared/public-url.js';

/**
 * @typedef {Object} TunnelProcess
 * @property {import('child_process').ChildProcess} process - Child process
 * @property {Promise<string>} urlPromise - Promise resolving to tunnel URL
 */

const HOME = process.env.HOME || process.cwd();
const BIN_DIR = join(HOME, '.pocket-server', 'cloudflared', '1.10.0');
const BIN_PATH = join(BIN_DIR, 'cloudflared');

/**
 * Detect system architecture
 * @returns {'amd64' | 'arm64'} System architecture
 */
function detectArch() {
  const arch = process.arch;
  if (arch === 'arm64') return 'arm64';
  return 'amd64';
}

/**
 * Detect operating system
 * @returns {'darwin' | 'linux'} Operating system
 */
function detectOS() {
  if (process.platform === 'darwin') return 'darwin';
  // Default to linux for non-darwin POSIX platforms
  return 'linux';
}

/**
 * Get cloudflared download URL for current platform
 * @returns {string} Download URL
 */
function getDownloadUrl() {
  const arch = detectArch();
  const os = detectOS();
  // Official release tgz with latest tag
  return `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${os}-${arch}.tgz`;
}

/**
 * Extract tar.gz file to destination directory
 * @param {string} tgzPath - Path to tar.gz file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
async function extractTgz(tgzPath, destDir) {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', tgzPath, '-C', destDir]);
    tar.on('exit', (code) => {
      if (code === 0) {
        // The archive usually contains a file named 'cloudflared'
        resolve();
      } else {
        reject(new Error(`tar exit code ${code}`));
      }
    });
    tar.on('error', reject);
  });
}

/**
 * Download and install cloudflared binary
 * @returns {Promise<string>} Path to binary
 */
async function fetchBinary() {
  if (existsSync(BIN_PATH)) return BIN_PATH;

  mkdirSync(BIN_DIR, { recursive: true });
  const url = getDownloadUrl();

  logger.info('Tunnel', 'Downloading cloudflared tgz');
  const res = await fetch(url, { headers: { 'User-Agent': 'pocket-server/1.0' } });
  if (!res.ok) throw new Error(`Failed to download cloudflared: HTTP ${res.status}`);

  const tgzPath = join(BIN_DIR, 'cloudflared.tgz');
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(tgzPath, buf);

  await extractTgz(tgzPath, BIN_DIR);

  try { unlinkSync(tgzPath); } catch {}
  try { chmodSync(BIN_PATH, 0o755); } catch {}

  if (!existsSync(BIN_PATH)) {
    throw new Error('cloudflared binary not found after extract');
  }

  logger.info('Tunnel', 'cloudflared binary installed', { path: BIN_PATH });
  return BIN_PATH;
}

/**
 * Start a Cloudflare quick tunnel
 * @param {number} port - Local port to expose
 * @returns {Promise<TunnelProcess>} Tunnel process and URL promise
 */
export async function startQuickTunnel(port) {
  const bin = await fetchBinary();

  // Default to 'info' so cloudflared prints the assigned public URL
  const logLevel = process.env.CF_TUNNEL_LOGLEVEL || 'info';
  const VERBOSE = (process.env.CF_TUNNEL_VERBOSE === '1' || process.env.CF_TUNNEL_VERBOSE === 'true');

  const args = ['tunnel', '--no-autoupdate', '--loglevel', logLevel, '--url', `http://localhost:${port}`];

  logger.info('Tunnel', 'Starting quick tunnel', { args: args.join(' ') });

  const child = spawn(bin, args, { env: process.env });

  let urlResolve;
  let urlReject;
  const urlPromise = new Promise((resolve, reject) => {
    urlResolve = resolve;
    urlReject = reject;
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const onLine = (line) => {
    // Only accept the first URL we see per process
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      const url = match[0];
      const current = getCurrentPublicUrl();
      if (!current) {
        setPublicBaseUrl(url);
        logger.info('Tunnel', 'public_url_assigned', { url });
        urlResolve(url);
      }
    }
  };

  child.stdout.on('data', (d) => {
    const s = d.toString();
    s.split('\n').forEach((ln) => {
      const line = ln.trim();
      if (!line) return;
      if (VERBOSE) logger.info('Tunnel', line);
      onLine(line);
    });
  });

  child.stderr.on('data', (d) => {
    const s = d.toString();
    s.split('\n').forEach((ln) => {
      const line = ln.trim();
      if (!line) return;
      if (VERBOSE) logger.info('Tunnel', line);
      onLine(line);
    });
  });

  child.on('exit', (code) => {
    logger.warn('Tunnel', `cloudflared exited with code ${code}`);
    setPublicBaseUrl(null);
    urlReject(new Error('cloudflared exited'));
  });

  return { process: child, urlPromise };
}

/**
 * Check if cloudflared binary is available
 * @returns {boolean} Whether binary exists
 */
export function isCloudflaredAvailable() {
  return existsSync(BIN_PATH);
}

/**
 * Get tunnel status
 * @returns {Object} Tunnel status information
 */
export function getTunnelStatus() {
  const currentUrl = getCurrentPublicUrl();
  const binaryExists = isCloudflaredAvailable();

  return {
    active: !!currentUrl,
    url: currentUrl,
    binaryInstalled: binaryExists,
    binaryPath: BIN_PATH,
    timestamp: new Date().toISOString()
  };
}