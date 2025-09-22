/**
 * OpenAI List Files Tool
 * Converted from TypeScript for SvelteKit with JSDoc types
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'list_files';

export const definition = {
  type: 'function',
  name,
  description: 'List files and directories in a workspace directory.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: current directory)' },
    },
    required: [],
  },
};

export async function run(input, { workingDir }) {
  const targetPath = input.path || '.';
  const res = await fileSystemService.list(resolvePath(workingDir, targetPath));
  if (!res.ok) throw res.error;
  return res.value;
}