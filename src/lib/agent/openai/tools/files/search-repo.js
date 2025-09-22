/**
 * OpenAI Search Repository Tool
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'search_repo';

export const definition = {
  type: 'function',
  name,
  description: 'Search for text content within files in the repository.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Text to search for' },
      path: { type: 'string', description: 'Directory to search in (default: current directory)' },
      file_pattern: { type: 'string', description: 'File pattern to match (e.g., "*.js")' },
    },
    required: ['query'],
  },
};

export async function run(input, { workingDir }) {
  const searchPath = input.path || '.';
  const res = await fileSystemService.grep(resolvePath(workingDir, searchPath), {
    pattern: input.query,
    filePattern: input.file_pattern,
  });
  if (!res.ok) throw res.error;
  return res.value;
}