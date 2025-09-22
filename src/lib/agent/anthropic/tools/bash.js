/**
 * Bash Tool Implementation
 * Converted from TypeScript for SvelteKit with JSDoc types
 * 
 * Wraps the existing terminal service for Anthropic API compatibility
 * 
 * @fileoverview Bash command execution tool for Claude agent
 */

/**
 * @typedef {Object} BashToolInput
 * @property {string} [command] - Command to execute
 * @property {boolean} [restart] - Whether to restart bash session
 */

/**
 * @typedef {Object} BashTool
 * @property {'bash_20250124'} type - Tool type
 * @property {'bash'} name - Tool name
 */

/**
 * Bash tool definition for Anthropic API
 * @type {BashTool}
 */
export const bashToolDefinition = {
  type: 'bash_20250124',
  name: 'bash'
};

/**
 * Execute bash command using existing terminal service
 * @param {BashToolInput} input - Tool input parameters
 * @param {string} workingDir - Working directory for command execution
 * @returns {Promise<string>} Command output or error message
 */
export async function executeBash(input, workingDir) {
  // Handle restart command
  if (input.restart) {
    return 'Bash session restarted';
  }

  // Validate command
  if (!input.command) {
    return 'Error: No command provided';
  }

  try {
    // Import terminal service dynamically to avoid circular imports
    const { terminalService } = await import('../../../file-system/terminal.js');
    
    // Execute using terminal service
    const result = await terminalService.execute({
      command: input.command,
      cwd: workingDir,
      timeout: 30000 // 30 second timeout
    });

    if (!result.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (result);
      return `Error: ${error.error.message}`;
    }

    // Format output
    const { stdout, stderr, exitCode } = result.value;
    
    // Combine stdout and stderr
    let output = stdout;
    if (stderr) {
      output += stderr ? `\n${stderr}` : '';
    }

    // If no output, indicate completion
    if (!output.trim()) {
      return `Command completed with exit code ${exitCode}`;
    }

    return truncateOutput(output);
  } catch (error) {
    return `Error executing command: ${error.message}`;
  }
}

/**
 * Truncate output to stay within token limits
 * @param {string} output - Command output to truncate
 * @returns {string} Truncated output
 */
function truncateOutput(output) {
  const maxChars = 50000; // ~12.5k tokens
  const maxLines = 1000;
  
  if (output.length <= maxChars) {
    return output;
  }
  
  const lines = output.split('\n');
  
  if (lines.length > maxLines) {
    // Line-based truncation
    const truncatedLines = lines.slice(0, maxLines);
    const truncated = truncatedLines.join('\n');
    
    if (truncated.length > maxChars) {
      // Still too long, do character truncation
      return `${truncated.substring(0, maxChars)}\n\n... Output truncated (${lines.length} total lines) ...`;
    }
    
    return `${truncated}\n\n... Output truncated (${lines.length} total lines) ...`;
  }
  
  // Simple character truncation
  return `${output.substring(0, maxChars)}\n\n... Output truncated (${output.length} total characters) ...`;
}

/**
 * Check if a command is dangerous (for max mode auto-approval)
 * @param {string} command - Command to check
 * @returns {boolean} Whether command is considered dangerous
 */
export function isBashCommandDangerous(command) {
  const dangerousPatterns = [
    /\brm\s+-rf\s+\//,           // rm -rf on root paths
    /\bsudo\b/,                  // sudo commands
    /\b(shutdown|reboot|halt)\b/, // system control
    /\bmkfs\b/,                  // filesystem formatting
    /\bdd\s+.*of=\/dev/,         // dd to devices
    /\b:\(\)\s*\{.*:\|:/,       // fork bomb
    /\b(kill|pkill|killall)\s+-9/, // force kill
  ];

  return dangerousPatterns.some(pattern => pattern.test(command));
}