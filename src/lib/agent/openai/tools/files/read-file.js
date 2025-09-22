/**
 * OpenAI Read File Tool
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * @fileoverview Read file tool for OpenAI
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'read_file';

export const definition = {
  type: 'function',
  name,
  description: 'Read a text file from the workspace and return its content.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', description: 'Path of the file to read' },
    },
    required: ['path'],
  },
};

/**
 * @type {import('../types.js').ToolHandler<{path: string}, any>}
 */
export async function run(input, { workingDir }) {
  const res = await fileSystemService.read(resolvePath(workingDir, input.path));
  if (!res.ok) throw res.error;
  return res.value;
}