/**
 * OpenAI Get Git Working State Tool
 */

import { spawn } from 'child_process';

export const name = 'get_git_working_state';

export const definition = {
  type: 'function',
  name,
  description: 'Get the current Git working directory status.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

export async function run(input, { workingDir, sessionId }) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['status', '--porcelain'], {
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
      resolve({
        status: stdout,
        error: stderr,
        exitCode: code,
      });
    });

    child.on('error', (err) => {
      reject(new Error(`Git command failed: ${err.message}`));
    });
  });
}