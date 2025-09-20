/**
 * OpenAI Write File Tool
 * Converted from TypeScript for SvelteKit with JSDoc types
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'write_file';

export const definition = {
  type: 'function',
  name,
  description: 'Write content to a file in the workspace.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', description: 'Path of the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

export async function run(input, { workingDir }) {
  const res = await fileSystemService.write(resolvePath(workingDir, input.path), input.content);
  if (!res.ok) throw res.error;
  return res.value;
}