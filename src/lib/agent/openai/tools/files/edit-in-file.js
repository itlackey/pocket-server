/**
 * OpenAI Edit File Tool
 * Converted from TypeScript for SvelteKit with JSDoc types
 */

import { fileSystemService } from '$lib/file-system/service.js';
import { resolvePath } from '../util.js';

export const name = 'edit_in_file';

export const definition = {
  type: 'function',
  name,
  description: 'Edit a file by replacing old text with new text.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', description: 'Path of the file to edit' },
      old: { type: 'string', description: 'Text to replace' },
      new: { type: 'string', description: 'New text to insert' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
    },
    required: ['path', 'old', 'new'],
  },
};

export async function run(input, { workingDir }) {
  const res = await fileSystemService.edit(resolvePath(workingDir, input.path), {
    operation: 'str_replace',
    old_str: input.old,
    new_str: input.new,
    replace_all: input.replace_all || false,
  });
  if (!res.ok) throw res.error;
  return res.value;
}