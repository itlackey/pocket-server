import { existsSync, mkdirSync } from 'fs';
import os from 'os';
import { join } from 'path';

/**
 * Resolves a path under the server's data directory.
 * Defaults to process.env.POCKET_DATA_DIR || <homedir>/.pocket-server/data
 * @param {...string} segments - Path segments to join
 * @returns {string} The resolved path
 */
export function resolveDataPath(...segments) {
  const defaultBase = join(os.homedir(), '.pocket-server', 'data');
  const base = process.env.POCKET_DATA_DIR ? process.env.POCKET_DATA_DIR : defaultBase;
  const full = join(base, ...segments);
  return full;
}

/**
 * Ensures that a directory exists.
 * @param {string} dirPath - The directory path to ensure
 */
export function ensureDirPath(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}