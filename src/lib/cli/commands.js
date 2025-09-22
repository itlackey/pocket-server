/**
 * CLI Commands
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Command-line interface for server management
 *
 * @fileoverview CLI command implementations
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import os from 'os';
import WebSocket from 'ws';
import { logger } from '$lib/shared/logger.js';
import { resolveDataPath } from '$lib/shared/paths.js';
import { getPublicBaseUrl, setPublicBaseUrl } from '$lib/shared/public-url.js';
import { createHelpDisplay, createPairingDisplay, status } from '$lib/shared/terminal-ui.js';

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * @typedef {Object} ParsedArgs
 * @property {string} cmd - Command name
 * @property {string} [subcmd] - Subcommand name
 * @property {Record<string, string | boolean>} flags - Command flags
 */

/**
 * @typedef {Object} TerminalRegistryItem
 * @property {string} id - Terminal ID
 * @property {string} [title] - Terminal title
 * @property {string} cwd - Working directory
 * @property {number} createdAt - Creation timestamp
 * @property {number} [cols] - Terminal columns
 * @property {number} [rows] - Terminal rows
 * @property {boolean} active - Whether terminal is active
 * @property {string} [ownerClientId] - Owner client ID
 * @property {string} [ownerDeviceId] - Owner device ID
 * @property {number} [lastAttachedAt] - Last attached timestamp
 */

/**
 * Print help information
 */
export function printHelp() {
  console.log(createHelpDisplay());
}

/**
 * Parse command line arguments
 * @param {string[]} argv - Command line arguments
 * @returns {ParsedArgs} Parsed arguments
 */
export function parseArgs(argv) {
  const out = {};
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'start';
  let subcmd;
  const rest = argv[0] === cmd ? argv.slice(1) : argv.slice(0);
  let skipIndex = null;

  if (cmd === 'terminal' && rest.length > 0 && !rest[0].startsWith('-')) {
    const candidate = rest[0];
    if (candidate === 'sessions' || candidate === 'attach' || candidate === 'select') {
      subcmd = candidate;
      // Optional positional query after subcmd (e.g., terminal attach opencode)
      if (rest[1] && !rest[1].startsWith('-')) {
        out.query = rest[1];
        skipIndex = 1;
      }
    } else {
      // Treat as positional query (e.g., terminal opencode)
      out.query = candidate;
      skipIndex = 0;
    }
  }

  for (let i = 0; i < rest.length; i++) {
    if (i === 0 && subcmd) continue; // skip the subcommand token
    if (skipIndex !== null && i === skipIndex) continue; // skip the positional query token
    const a = rest[i];
    if (a === '--') break;

    if (a.startsWith('--')) {
      const [rawK, rawV] = a.slice(2).split('=');
      const k = rawK.trim();
      if (rawV !== undefined) {
        out[k] = rawV;
      } else {
        // generic support space-separated values: --key value
        const next = rest[i + 1];
        if (next && !next.startsWith('-')) {
          out[k] = next;
          i++;
        } else {
          out[k] = true;
        }
      }
      continue;
    }

    if (a.startsWith('-')) {
      if (a === '-r') {
        out.remote = true;
        continue;
      }
      if (a === '-h') {
        out.help = true;
        continue;
      }
      if (a.startsWith('-p=')) {
        out.port = a.split('=')[1];
        continue;
      }
      if (a === '-p') {
        const next = rest[i + 1];
        if (next && !next.startsWith('-')) {
          out.port = next;
          i++;
        }
      }
    }
  }

  return { cmd, subcmd, flags: out };
}

/**
 * Start the server
 * @param {number} port - Server port
 * @param {boolean} enableTunnel - Whether to enable tunnel
 */
export async function startServer(port, enableTunnel) {
  // Clear any stale cached public URL before starting a new tunnel
  setPublicBaseUrl(null);

  // Ensure server reads the desired port
  process.env.PORT = String(port);

  console.log(status.starting(port, enableTunnel));

  // Write PID
  try {
    const pidPath = resolveDataPath('runtime', 'server.pid');
    writeFileSync(pidPath, String(process.pid), 'utf8');
    process.on('exit', () => { try { unlinkSync(pidPath); } catch {} });
    process.on('SIGINT', () => { try { unlinkSync(pidPath); } catch {}; process.exit(0); });
  } catch {}

  // Optionally start Cloudflare quick tunnel
  if (enableTunnel) {
    try {
      const { startQuickTunnel } = await import('$lib/tunnel/cloudflare.js');
      const t = await startQuickTunnel(port);
      let printed = false;

      const maybePrint = () => {
        const found = getPublicBaseUrl();
        if (found && !printed) {
          logger.info('Tunnel', 'public_url_ready', { url: found });
          console.log(status.tunnelReady(found));
          printed = true;
          clearInterval(timer);
        }
      };

      const timer = setInterval(maybePrint, 1000);
      t.urlPromise.then((u) => { setPublicBaseUrl(u); maybePrint(); }).catch(() => {});
    } catch (e) {
      console.log(status.tunnelFailed(e.message));
      setPublicBaseUrl(null);
    }
  }
}

/**
 * Start command implementation
 * @param {Record<string, string | boolean>} flags - Command flags
 */
export async function cmdStart(flags) {
  const port = flags.port ? Number(flags.port) : DEFAULT_PORT;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${flags.port}`);
    process.exit(2);
  }
  const enableTunnel = Boolean(flags.remote);
  await startServer(port, enableTunnel);
}

/**
 * Pair command implementation
 * @param {Record<string, string | boolean>} flags - Command flags
 */
export async function cmdPair(flags) {
  const port = flags.port ? Number(flags.port) : DEFAULT_PORT;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${flags.port}`);
    process.exit(2);
  }

  await startServer(port, false);

  const { startPairingWindow } = await import('$lib/auth/pairing.js');
  const pinArg = typeof flags.pin === 'string' ? String(flags.pin) : undefined;
  const durationMs = typeof flags.duration === 'string' ? Math.max(10_000, Number(flags.duration)) : 60_000;
  const { pin, expiresAt } = startPairingWindow(durationMs, pinArg);

  const nets = os.networkInterfaces();
  const urls = [];
  Object.values(nets).forEach(ifaces => {
    ifaces?.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        urls.push(`http://${addr.address}:${port}`);
      }
    });
  });

  const expiresInSec = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const pub = getPublicBaseUrl();

  console.log(`\n${createPairingDisplay(pin, expiresInSec, urls, !!pub)}\n`);
}

/**
 * Stop command implementation
 */
export async function cmdStop() {
  const pidPath = resolveDataPath('runtime', 'server.pid');
  if (!existsSync(pidPath)) {
    console.log(status.notRunning());
    return;
  }

  try {
    const pid = Number(readFileSync(pidPath, 'utf8'));
    process.kill(pid, 'SIGINT');
    console.log(status.stopping());
    try { unlinkSync(pidPath); } catch {}
  } catch (e) {
    console.error('Failed to stop server:', e.message);
  }
}

/**
 * Update command implementation
 */
export async function cmdUpdate() {
  // Delegate to installer script hosted on the website
  const installerUrl = process.env.POCKET_INSTALL_URL || 'https://www.pocket-agent.xyz/install';
  console.log(status.updating());

  const sh = spawn('/bin/bash', ['-lc', `curl -fsSL ${installerUrl} | bash`], { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    sh.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Installer exited with code ${code}`)));
    sh.on('error', reject);
  });
}

/**
 * Derive title from terminal ID
 * @param {string} id - Terminal ID
 * @returns {string} Derived title
 */
function deriveTitleFromId(id) {
  const m = id.match(/#(\d+)$/);
  if (m) return `Terminal ${m[1]}`;
  return 'Terminal';
}

/**
 * Compact file path for display
 * @param {string} p - File path
 * @returns {string} Compacted path
 */
function compactPath(p) {
  try {
    const home = os.homedir();
    if (p.startsWith(home)) return '~' + p.slice(home.length);
  } catch {}
  return p;
}

/**
 * Load terminal sessions from registry
 * @returns {TerminalRegistryItem[]} Terminal sessions
 */
function loadTerminalSessions() {
  const path = resolveDataPath('runtime', 'term-sessions.json');
  if (!existsSync(path)) {
    return [];
  }

  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.sessions) ? data.sessions.slice() : [];
  } catch (e) {
    console.error('Failed to read terminal sessions:', e.message);
    return [];
  }
}

/**
 * Sort terminal sessions
 * @param {TerminalRegistryItem[]} sessions - Sessions to sort
 * @param {string} sort - Sort method
 * @returns {TerminalRegistryItem[]} Sorted sessions
 */
function sortSessions(sessions, sort) {
  const smart = (a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const la = a.lastAttachedAt || 0;
    const lb = b.lastAttachedAt || 0;
    if (la !== lb) return lb - la;
    return (a.createdAt || 0) - (b.createdAt || 0);
  };

  const created = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  const attached = (a, b) => (b.lastAttachedAt || 0) - (a.lastAttachedAt || 0);
  const title = (a, b) => (a.title || deriveTitleFromId(a.id)).localeCompare(b.title || deriveTitleFromId(b.id), undefined, { sensitivity: 'base' });

  const sorter = sort === 'created' ? created : sort === 'attached' ? attached : sort === 'title' ? title : smart;
  return sessions.sort(sorter);
}

/**
 * Format session line for display
 * @param {TerminalRegistryItem} s - Session
 * @param {number} index - Session index
 * @param {boolean} long - Whether to show long format
 * @returns {string} Formatted line
 */
function formatSessionLine(s, index, long) {
  const title = s.title || deriveTitleFromId(s.id);
  const cwd = compactPath(s.cwd);
  const size = s.cols && s.rows ? `${s.cols}x${s.rows}` : '';
  const active = s.active ? 'active' : 'inactive';
  const owner = s.ownerDeviceId ? ` · device:${s.ownerDeviceId}` : '';
  const idPart = long ? ` · id=${s.id}` : '';
  return `[${index}] ${title}:${idPart}${size ? ` · ${size}` : ''} · ${active} · ${cwd}${owner}`;
}

/**
 * Terminal command implementation
 * @param {Record<string, string | boolean>} flags - Command flags
 * @param {string} [subcmd] - Subcommand
 */
export async function cmdTerminal(flags, subcmd) {
  const action = subcmd || 'sessions';

  switch (action) {
    case 'sessions': {
      let sessions = loadTerminalSessions();
      if (sessions.length === 0) {
        console.log('No active terminal sessions.');
        return;
      }

      const sortKey = typeof flags.sort === 'string' ? String(flags.sort) : 'smart';
      sessions = sortSessions(sessions, sortKey);

      if (flags.json) {
        const enriched = sessions.map((s, i) => ({ index: i + 1, ...s }));
        console.log(JSON.stringify({ sessions: enriched }, null, 2));
        return;
      }

      const long = Boolean(flags.long);
      const lines = [];
      sessions.forEach((s, idx) => {
        lines.push(formatSessionLine(s, idx + 1, long));
      });
      console.log(lines.join('\n'));
      return;
    }

    case 'select':
    case 'attach': {
      console.log('Terminal attach functionality requires WebSocket connection to running server.');
      console.log('This feature is available through the web interface or direct WebSocket connection.');
      return;
    }

    default:
      console.log(status.unknownCommand(`terminal ${action}`));
  }
}

/**
 * Main CLI entry point
 * @param {string[]} argv - Command line arguments
 */
export async function main(argv) {
  const { cmd, subcmd, flags } = parseArgs(argv);

  if (flags.help || cmd === 'help') {
    printHelp();
    return;
  }

  switch (cmd) {
    case 'start':
      return cmdStart(flags);
    case 'pair':
      return cmdPair(flags);
    case 'stop':
      return cmdStop();
    case 'update':
      return cmdUpdate();
    case 'terminal':
      return cmdTerminal(flags, subcmd);
    default:
      console.log(status.unknownCommand(cmd));
      printHelp();
  }
}