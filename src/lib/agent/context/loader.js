/**
 * Project Context Loader
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Load project context by searching upward from workingDir for CLAUDE.md (preferred) or AGENTS.md.
 * For CLAUDE.md, resolve @imports recursively up to MAX_IMPORT_DEPTH, skipping code blocks/spans.
 *
 * @fileoverview Project context loading with import resolution
 */

import os from 'node:os';
import { promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { MAX_CONTEXT_BYTES, MAX_IMPORT_DEPTH } from './config.js';

/**
 * @typedef {'CLAUDE.md' | 'AGENTS.md'} ProjectContextSource
 */

/**
 * @typedef {Object} ProjectContext
 * @property {ProjectContextSource} source - Source file type
 * @property {string} path - Full path to context file
 * @property {string} content - Processed content with imports resolved
 * @property {string[]} [resolvedImports] - List of imported file paths
 * @property {boolean} [truncated] - Whether content was truncated due to size
 */

/**
 * @typedef {Object} LoadContextOptions
 * @property {'claude' | 'agents'} [preferred] - Preferred context file type
 */

/**
 * Load project context by searching upward from workingDir for CLAUDE.md (preferred) or AGENTS.md.
 * For CLAUDE.md, resolve @imports recursively up to MAX_IMPORT_DEPTH, skipping code blocks/spans.
 * @param {string} workingDir - Starting directory for search
 * @param {LoadContextOptions} [options] - Loading options
 * @returns {Promise<ProjectContext | null>} Project context or null if not found
 */
export async function loadProjectContext(workingDir, options) {
  const foundClaude = await findNearestFileUp(workingDir, 'CLAUDE.md');
  const foundAgents = await findNearestFileUp(workingDir, 'AGENTS.md');

  const preferAgents = (options?.preferred === 'agents');
  const chosen = preferAgents ? (foundAgents || foundClaude) : (foundClaude || foundAgents);
  if (!chosen) return null;

  /** @type {ProjectContextSource} */
  const source = chosen.endsWith(`${sep}CLAUDE.md`) ? 'CLAUDE.md' : 'AGENTS.md';

  let content = await fs.readFile(chosen, 'utf8').catch(() => '');
  /** @type {string[]} */
  const resolvedImports = [];

  if (source === 'CLAUDE.md') {
    content = await resolveClaudeImports(content, dirname(chosen), 0, resolvedImports);
  }

  // Normalize and cap size
  const normalized = normalizeContent(content);
  const { text, truncated } = capText(normalized, MAX_CONTEXT_BYTES);

  return {
    source,
    path: chosen,
    content: text,
    resolvedImports,
    truncated,
  };
}

/**
 * Find nearest file by walking up directory tree
 * @param {string} startDir - Starting directory
 * @param {string} filename - File to search for
 * @returns {Promise<string | null>} Full path to file or null if not found
 */
async function findNearestFileUp(startDir, filename) {
  try {
    let dir = resolve(startDir);
    while (true) {
      const candidate = join(dir, filename);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return candidate;
      } catch {}
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize content by collapsing excessive blank lines
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeContent(text) {
  // Collapse excessive blank lines and trim
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Cap text to maximum byte size with truncation notice
 * @param {string} text - Text to cap
 * @param {number} maxBytes - Maximum byte size
 * @returns {{text: string, truncated: boolean}} Capped text and truncation flag
 */
function capText(text, maxBytes) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return { text, truncated: false };

  // Find a safe cut point roughly at limit
  let end = maxBytes;
  // back up to previous newline boundary to avoid splitting mid-line
  while (end > 0 && bytes[end] !== 10 /* \n */) end--;
  if (end <= 0) end = maxBytes;
  const sliced = bytes.slice(0, end);
  const decoder = new TextDecoder();
  const head = decoder.decode(sliced);
  const notice = '\n\n[Note] Project context truncated due to size limit.\n';
  return { text: head + notice, truncated: true };
}

/**
 * Resolve @imports for CLAUDE.md, skipping matches inside fenced code blocks and inline code spans.
 * @param {string} content - Content to process
 * @param {string} baseDir - Base directory for relative imports
 * @param {number} depth - Current recursion depth
 * @param {string[]} seen - Array to track resolved imports
 * @returns {Promise<string>} Content with imports resolved
 */
async function resolveClaudeImports(content, baseDir, depth, seen) {
  if (depth >= MAX_IMPORT_DEPTH) return content;

  // Parse content to identify code blocks and inline code spans
  const codeRanges = findCodeRanges(content);

  // Find @import patterns not in code blocks
  const importPattern = /@import\s+([^\s\n]+)/g;
  let match;
  const replacements = [];

  while ((match = importPattern.exec(content)) !== null) {
    const [fullMatch, importPath] = match;
    const start = match.index;
    const end = start + fullMatch.length;

    // Skip if this match is inside a code block or span
    if (isInCodeRange(start, end, codeRanges)) {
      continue;
    }

    try {
      // Resolve the import path
      const resolvedPath = resolve(baseDir, importPath);

      // Avoid circular imports
      if (seen.includes(resolvedPath)) {
        replacements.push({
          start,
          end,
          replacement: `[Circular import: ${importPath}]`
        });
        continue;
      }

      // Read and process the imported file
      const importedContent = await fs.readFile(resolvedPath, 'utf8').catch(() => {
        return `[Import not found: ${importPath}]`;
      });

      if (importedContent.startsWith('[Import not found:')) {
        replacements.push({
          start,
          end,
          replacement: importedContent
        });
      } else {
        // Track this import
        seen.push(resolvedPath);

        // Recursively resolve imports in the imported content
        const processedImport = await resolveClaudeImports(
          importedContent,
          dirname(resolvedPath),
          depth + 1,
          seen
        );

        replacements.push({
          start,
          end,
          replacement: `\n<!-- Import: ${importPath} -->\n${processedImport}\n<!-- End Import -->\n`
        });
      }
    } catch (error) {
      replacements.push({
        start,
        end,
        replacement: `[Import error: ${importPath} - ${error.message}]`
      });
    }
  }

  // Apply replacements in reverse order to maintain indices
  replacements.reverse();
  let result = content;

  for (const { start, end, replacement } of replacements) {
    result = result.substring(0, start) + replacement + result.substring(end);
  }

  return result;
}

/**
 * Find all code ranges (fenced blocks and inline spans) in content
 * @param {string} content - Content to analyze
 * @returns {Array<{start: number, end: number}>} Array of code ranges
 */
function findCodeRanges(content) {
  const ranges = [];

  // Find fenced code blocks (``` or ```)
  const fencedPattern = /```[\s\S]*?```/g;
  let match;

  while ((match = fencedPattern.exec(content)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Find inline code spans (single backticks)
  const inlinePattern = /`[^`\n]+`/g;

  while ((match = inlinePattern.exec(content)) !== null) {
    // Make sure this isn't inside a fenced block
    const start = match.index;
    const end = start + match[0].length;

    if (!isInCodeRange(start, end, ranges)) {
      ranges.push({ start, end });
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Check if a position range is inside any code range
 * @param {number} start - Start position
 * @param {number} end - End position
 * @param {Array<{start: number, end: number}>} codeRanges - Code ranges to check against
 * @returns {boolean} True if position is in code range
 */
function isInCodeRange(start, end, codeRanges) {
  return codeRanges.some(range =>
    start >= range.start && end <= range.end
  );
}