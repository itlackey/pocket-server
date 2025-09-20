/**
 * GitHub Integration for Cursor
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview GitHub API integration for Cursor agent workflows
 */

import { logger } from '$lib/shared/logger.js';

/**
 * @typedef {Object} DiffLine
 * @property {'add' | 'delete' | 'normal'} type - Line type
 * @property {string} content - Line content
 * @property {number} [oldLine] - Old line number
 * @property {number} [newLine] - New line number
 */

/**
 * @typedef {Object} DiffHunk
 * @property {number} oldStart - Old start line
 * @property {number} oldLines - Old line count
 * @property {number} newStart - New start line
 * @property {number} newLines - New line count
 * @property {DiffLine[]} lines - Diff lines
 */

/**
 * @typedef {Object} DiffFile
 * @property {string} path - File path
 * @property {number} additions - Added lines count
 * @property {number} deletions - Deleted lines count
 * @property {'added' | 'modified' | 'deleted' | 'renamed'} status - File status
 * @property {string} [previousPath] - Previous path for renamed files
 * @property {DiffHunk[]} hunks - Diff hunks
 */

/**
 * @typedef {Object} StructuredDiff
 * @property {DiffFile[]} files - Diff files
 * @property {Object} stats - Diff statistics
 * @property {number} stats.filesChanged - Number of files changed
 * @property {number} stats.additions - Total additions
 * @property {number} stats.deletions - Total deletions
 * @property {Object} [prInfo] - PR information
 * @property {number} prInfo.number - PR number
 * @property {string} prInfo.title - PR title
 * @property {string} prInfo.state - PR state
 * @property {string} prInfo.baseRef - Base reference
 * @property {string} prInfo.headRef - Head reference
 * @property {Object} [compareInfo] - Compare information
 * @property {string} compareInfo.baseRef - Base reference
 * @property {string} compareInfo.headRef - Head reference
 */

/**
 * Extract GitHub repository info from a PR URL
 * @param {string} prUrl - PR URL
 * @returns {{owner: string, repo: string, prNumber: number} | null} Extracted info
 */
export function extractGitHubInfo(prUrl) {
  try {
    // Match GitHub PR URL pattern: https://github.com/owner/repo/pull/123
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) {
      logger.warn('GitHub', 'Invalid PR URL format', { prUrl });
      return null;
    }

    return {
      owner: match[1],
      repo: match[2],
      prNumber: parseInt(match[3], 10),
    };
  } catch (error) {
    logger.error('GitHub', 'Failed to extract info from PR URL', { prUrl, error });
    return null;
  }
}

/**
 * Parse a GitHub repository URL like github.com/owner/repo into owner/repo
 * @param {string} repoUrl - Repository URL
 * @returns {{owner: string, repo: string} | null} Parsed info
 */
export function parseRepositoryUrl(repoUrl) {
  try {
    // Accept with or without https:// prefix
    const clean = repoUrl.replace(/^https?:\/\//, '');
    const match = clean.match(/github\.com\/([^/]+)\/([^/?#]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

/**
 * Fetch PR information from GitHub API
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<Object>} PR information
 */
export async function fetchPRInfo(token, owner, repo, prNumber) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      baseRef: data.base.ref,
      headRef: data.head.ref,
      body: data.body,
      author: data.user.login,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    logger.error('GitHub', 'Failed to fetch PR info', {
      owner,
      repo,
      prNumber,
      error: error.message
    });
    throw error;
  }
}

/**
 * Fetch PR diff from GitHub API
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<string>} Raw diff content
 */
export async function fetchPRDiff(token, owner, repo, prNumber) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3.diff',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    return await response.text();
  } catch (error) {
    logger.error('GitHub', 'Failed to fetch PR diff', {
      owner,
      repo,
      prNumber,
      error: error.message
    });
    throw error;
  }
}

/**
 * Parse unified diff format into structured data
 * @param {string} diffText - Raw diff text
 * @returns {StructuredDiff} Structured diff
 */
export function parseUnifiedDiff(diffText) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  let stats = { filesChanged: 0, additions: 0, deletions: 0 };

  const lines = diffText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
        stats.filesChanged++;
      }

      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (match) {
        currentFile = {
          path: match[2],
          previousPath: match[1] !== match[2] ? match[1] : undefined,
          additions: 0,
          deletions: 0,
          status: 'modified',
          hunks: []
        };
      }
      currentHunk = null;
    }

    // File status indicators
    if (line.startsWith('new file mode')) {
      if (currentFile) currentFile.status = 'added';
    }
    if (line.startsWith('deleted file mode')) {
      if (currentFile) currentFile.status = 'deleted';
    }
    if (line.startsWith('rename from')) {
      if (currentFile) currentFile.status = 'renamed';
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match && currentFile) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          lines: []
        };
        currentFile.hunks.push(currentHunk);
      }
    }

    // Content lines
    if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      let type = 'normal';
      let content = line.slice(1);

      if (line.startsWith('+')) {
        type = 'add';
        currentFile.additions++;
        stats.additions++;
      } else if (line.startsWith('-')) {
        type = 'delete';
        currentFile.deletions++;
        stats.deletions++;
      }

      currentHunk.lines.push({
        type,
        content
      });
    }
  }

  // Add the last file
  if (currentFile) {
    files.push(currentFile);
    stats.filesChanged++;
  }

  return { files, stats };
}

/**
 * Fetch structured diff for a PR
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<StructuredDiff>} Structured diff with PR info
 */
export async function fetchStructuredPRDiff(token, owner, repo, prNumber) {
  try {
    const [prInfo, diffText] = await Promise.all([
      fetchPRInfo(token, owner, repo, prNumber),
      fetchPRDiff(token, owner, repo, prNumber)
    ]);

    const structuredDiff = parseUnifiedDiff(diffText);

    structuredDiff.prInfo = {
      number: prInfo.number,
      title: prInfo.title,
      state: prInfo.state,
      baseRef: prInfo.baseRef,
      headRef: prInfo.headRef
    };

    return structuredDiff;
  } catch (error) {
    logger.error('GitHub', 'Failed to fetch structured PR diff', {
      owner,
      repo,
      prNumber,
      error: error.message
    });
    throw error;
  }
}

/**
 * Fetch files in a repository
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} [ref] - Git reference (default: main branch)
 * @param {string} [path] - Path to list (default: root)
 * @returns {Promise<Array>} Repository files
 */
export async function fetchRepositoryFiles(token, owner, repo, ref = 'main', path = '') {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('GitHub', 'Failed to fetch repository files', {
      owner,
      repo,
      ref,
      path,
      error: error.message
    });
    throw error;
  }
}