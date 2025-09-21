/**
 * Web Search Tool Implementation
 * Converted from TypeScript for SvelteKit with JSDoc types
 * 
 * Web search is handled server-side by Anthropic API
 * This file provides the tool definition and helper functions
 * 
 * @fileoverview Web search tool for Claude agent
 */

/**
 * @typedef {Object} WebSearchToolInput
 * @property {string} [query] - Single search query
 * @property {string[]} [queries] - Multiple search queries
 */

/**
 * @typedef {Object} WebSearchResult
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} [page_age] - Page age information
 */

/**
 * @typedef {Object} WebSearchTool
 * @property {'web_search_20250305'} type - Tool type
 * @property {'web_search'} name - Tool name
 * @property {number} [max_uses] - Maximum uses per request
 * @property {string[]} [allowed_domains] - Allowed domains
 * @property {string[]} [blocked_domains] - Blocked domains
 */

/**
 * Web search tool definition for Anthropic API
 * @type {WebSearchTool}
 */
export const webSearchToolDefinition = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 5 // Default to 5 searches per request
};

/**
 * Create web search tool with custom configuration
 * @param {Object} [config] - Configuration options
 * @param {number} [config.maxUses] - Maximum uses per request
 * @param {string[]} [config.allowedDomains] - Allowed domains
 * @param {string[]} [config.blockedDomains] - Blocked domains
 * @returns {WebSearchTool} Configured web search tool
 */
export function createWebSearchTool(config) {
  return {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: config?.maxUses ?? 5,
    allowed_domains: config?.allowedDomains,
    blocked_domains: config?.blockedDomains
  };
}

/**
 * Execute web search (placeholder - actual search is done by Anthropic)
 * @param {WebSearchToolInput} input - Search input
 * @param {string} workingDir - Working directory (unused for web search)
 * @returns {Promise<string>} Search status message
 */
export async function executeWebSearch(input, workingDir) {
  // Web search is handled by Anthropic API server-side
  // This is just a placeholder for consistency
  
  // Handle both single query and multiple queries
  if (input.query) {
    return `Web search in progress for: ${input.query}`;
  } else if (input.queries && Array.isArray(input.queries)) {
    const queryList = input.queries.join(', ');
    return `Web search in progress for: ${queryList}`;
  } else {
    return 'Web search in progress...';
  }
}

/**
 * Format web search results for display
 * @param {WebSearchResult[]} results - Search results
 * @returns {string} Formatted results string
 */
export function formatWebSearchResults(results) {
  if (results.length === 0) {
    return 'No search results found';
  }

  const lines = [`Found ${results.length} search results:\n`];
  
  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   ${result.url}`);
    if (result.page_age) {
      lines.push(`   Last updated: ${result.page_age}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Check if web search is safe (always true for max mode)
 * @param {WebSearchToolInput} input - Search input to check
 * @returns {boolean} Whether search is considered dangerous (always false)
 */
export function isWebSearchDangerous(input) {
  // Web search is always considered safe for auto-approval
  return false;
}