/**
 * OpenAI Tools Registry
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Central registry for OpenAI tool definitions and implementations
 *
 * @fileoverview OpenAI tools registry and exports
 */

import * as appendToFile from './files/append-to-file.js';
import * as editInFile from './files/edit-in-file.js';
import * as listFiles from './files/list-files.js';
import * as readFile from './files/read-file.js';
import * as searchFiles from './files/search-files.js';
import * as searchRepo from './files/search-repo.js';
import * as writeFile from './files/write-file.js';
import * as workPlan from './planning/work-plan.js';
import * as executeCommand from './terminal/execute-command.js';
import * as getGitWorkingState from './terminal/get-git-working-state.js';

/**
 * @typedef {Object} ToolModule
 * @property {string} name - Tool name
 * @property {Object} definition - Tool definition for OpenAI
 * @property {function(any, {workingDir: string, sessionId?: string}): Promise<any>} run - Tool execution function
 */

/** @type {ToolModule[]} */
export const modules = [
  listFiles,
  readFile,
  writeFile,
  searchFiles,
  searchRepo,
  editInFile,
  appendToFile,
  getGitWorkingState,
  executeCommand,
  workPlan,
];

/**
 * OpenAI tools mapped by name for execution
 * @type {Record<string, function(any, {workingDir: string, sessionId?: string}): Promise<any>>}
 */
export const openaiTools = Object.fromEntries(
  modules.map((m) => [m.name, (input, ctx) => m.run(input, ctx)])
);

/**
 * OpenAI tool definitions for API
 * @type {Object[]}
 */
export const openaiToolDefinitions = modules.map((m) => m.definition);