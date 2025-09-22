/**
 * OpenAI Append to File Tool
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'append_to_file';

export const definition = {
  type: 'function',
  name,
  description: 'Append text to the end of a file.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', description: 'Path of the file to append to' },
      text: { type: 'string', description: 'Text to append to the file' },
    },
    required: ['path', 'text'],
  },
};

export async function run(input, { workingDir }) {
  const res = await fileSystemService.append(resolvePath(workingDir, input.path), input.text);
  if (!res.ok) throw res.error;
  return res.value;
}