/**
 * OpenAI Search Files Tool
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'search_files';

export const definition = {
  type: 'function',
  name,
  description: 'Search for files by name pattern in the workspace.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Search query or pattern' },
      path: { type: 'string', description: 'Directory to search in (default: current directory)' },
    },
    required: ['query'],
  },
};

export async function run(input, { workingDir }) {
  const searchPath = input.path || '.';
  const res = await fileSystemService.search(resolvePath(workingDir, searchPath), input.query);
  if (!res.ok) throw res.error;
  return res.value;
}