/**
 * OpenAI Execute Command Tool
 */

import { spawn } from 'child_process';
import { logger } from '$lib/shared/logger.js';

export const name = 'execute_command';

export const definition = {
  type: 'function',
  name,
  description: 'Execute a shell command in the terminal.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
    },
    required: ['command'],
  },
};

export async function run(input, { workingDir, sessionId }) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', input.command], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

      logger.debug('OpenAI', 'command_executed', {
        command: input.command,
        exitCode: code,
        workingDir,
        sessionId
      });

      resolve({
        output,
        exitCode: code,
        success: code === 0,
      });
    });

    child.on('error', (err) => {
      reject(new Error(`Command execution failed: ${err.message}`));
    });
  });
}