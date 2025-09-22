/**
 * Text Editor Tool Implementation
 * Converted from TypeScript for SvelteKit with JSDoc types
 * 
 * Wraps the existing file system service for Anthropic API compatibility
 * 
 * @fileoverview Text editor tool for Claude agent file operations
 */

import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * @typedef {Object} ViewCommand
 * @property {'view'} command - Command type
 * @property {string} path - File or directory path
 * @property {[number, number]} [view_range] - Optional line range [start, end]
 */

/**
 * @typedef {Object} StrReplaceCommand
 * @property {'str_replace'} command - Command type
 * @property {string} path - File path
 * @property {string} old_str - Text to replace
 * @property {string} new_str - Replacement text
 */

/**
 * @typedef {Object} CreateCommand
 * @property {'create'} command - Command type
 * @property {string} path - File path
 * @property {string} file_text - File content
 */

/**
 * @typedef {Object} InsertCommand
 * @property {'insert'} command - Command type
 * @property {string} path - File path
 * @property {number} insert_line - Line number to insert at
 * @property {string} new_str - Text to insert
 */

/**
 * @typedef {Object} UndoCommand
 * @property {'undo_edit'} command - Command type
 */

/**
 * @typedef {ViewCommand | StrReplaceCommand | CreateCommand | InsertCommand | UndoCommand} TextEditorCommand
 */

/**
 * @typedef {Object} TextEditorTool
 * @property {'text_editor_20250429'} type - Tool type
 * @property {'str_replace_based_edit_tool'} name - Tool name
 */

/**
 * Text editor tool definition for Anthropic API
 * @type {TextEditorTool}
 */
export const editorToolDefinition = {
  type: 'text_editor_20250429',
  name: 'str_replace_based_edit_tool'
};

/**
 * Execute text editor commands
 * @param {TextEditorCommand} input - Command input
 * @param {string} workingDir - Working directory for relative paths
 * @returns {Promise<string>} Command result or error message
 */
export async function executeEditor(input, workingDir) {
  try {
    switch (input.command) {
      case 'view':
        return await viewFile(/** @type {ViewCommand} */ (input), workingDir);
      case 'str_replace':
        return await strReplace(/** @type {StrReplaceCommand} */ (input), workingDir);
      case 'create':
        return await createFile(/** @type {CreateCommand} */ (input), workingDir);
      case 'insert':
        return await insertText(/** @type {InsertCommand} */ (input), workingDir);
      case 'undo_edit':
        return 'Error: undo_edit is not supported in this version';
      default:
        return `Error: Unknown command ${/** @type {any} */ (input).command}`;
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * View file or directory contents
 * @param {ViewCommand} input - View command
 * @param {string} workingDir - Working directory
 * @returns {Promise<string>} File/directory contents or error
 */
async function viewFile(input, workingDir) {
  const fullPath = resolve(workingDir, input.path);
  
  try {
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      // List directory contents
      const { fileSystemService } = await import('../../../file-system/service.js');
      const result = await fileSystemService.list(fullPath);
      
      if (!result.ok) {
        const error = /** @type {{ok: false, error: Error}} */ (result);
        return `Error: ${error.error.message}`;
      }
      
      // Format directory listing
      const lines = ['Directory contents:'];
      for (const node of result.value.nodes) {
        const type = node.type === 'directory' ? 'd' : 'f';
        lines.push(`[${type}] ${node.name}`);
      }
      return lines.join('\\n');
    } else {
      // Read file contents
      const { fileSystemService } = await import('../../../file-system/service.js');
      const result = await fileSystemService.read(fullPath);
      
      if (!result.ok) {
        const error = /** @type {{ok: false, error: Error}} */ (result);
        return `Error: ${error.error.message}`;
      }
      
      // Format with line numbers if view_range is not specified
      if (!input.view_range) {
        const lines = result.value.content.split('\\n');
        const numberedLines = lines.map((line, i) => `${i + 1}: ${line}`);
        return numberedLines.join('\\n');
      }
      
      // Handle view_range
      const [start, end] = input.view_range;
      const lines = result.value.content.split('\\n');
      const startLine = Math.max(1, start);
      const endLine = end === -1 ? lines.length : Math.min(lines.length, end);
      
      const selectedLines = lines.slice(startLine - 1, endLine);
      const numberedLines = selectedLines.map((line, i) => `${startLine + i}: ${line}`);
      return numberedLines.join('\\n');
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * Replace text in file
 * @param {StrReplaceCommand} input - Replace command
 * @param {string} workingDir - Working directory
 * @returns {Promise<string>} Success message or error
 */
async function strReplace(input, workingDir) {
  const fullPath = resolve(workingDir, input.path);
  
  try {
    // Import file system service dynamically
    const { fileSystemService } = await import('../../../file-system/service.js');
    
    // Read current content
    const readResult = await fileSystemService.read(fullPath);
    if (!readResult.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (readResult);
      return `Error: ${error.error.message}`;
    }
    
    const content = readResult.value.content;
    const { old_str, new_str } = input;
    
    // Count occurrences
    const occurrences = content.split(old_str).length - 1;
    
    if (occurrences === 0) {
      return 'Error: No match found for replacement text';
    }
    
    if (occurrences > 1) {
      return `Error: Found ${occurrences} matches. Please provide more specific text to match exactly one location`;
    }
    
    // Perform replacement
    const newContent = content.replace(old_str, new_str);
    
    // Write back
    const writeResult = await fileSystemService.write(fullPath, newContent);
    if (!writeResult.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (writeResult);
      return `Error: ${error.error.message}`;
    }
    
    return 'Successfully replaced text at exactly one location';
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * Create new file
 * @param {CreateCommand} input - Create command
 * @param {string} workingDir - Working directory
 * @returns {Promise<string>} Success message or error
 */
async function createFile(input, workingDir) {
  const fullPath = resolve(workingDir, input.path);
  
  // Check if file already exists
  try {
    await stat(fullPath);
    return 'Error: File already exists';
  } catch {
    // File doesn't exist, good to create
  }
  
  try {
    // Import file system service dynamically
    const { fileSystemService } = await import('../../../file-system/service.js');
    
    // Write file
    const writeResult = await fileSystemService.write(fullPath, input.file_text);
    if (!writeResult.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (writeResult);
      return `Error: ${error.error.message}`;
    }
    
    return `Successfully created file: ${input.path}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * Insert text at specific line
 * @param {InsertCommand} input - Insert command
 * @param {string} workingDir - Working directory
 * @returns {Promise<string>} Success message or error
 */
async function insertText(input, workingDir) {
  const fullPath = resolve(workingDir, input.path);
  
  try {
    // Import file system service dynamically
    const { fileSystemService } = await import('../../../file-system/service.js');
    
    // Read current content
    const readResult = await fileSystemService.read(fullPath);
    if (!readResult.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (readResult);
      return `Error: ${error.error.message}`;
    }
    
    const lines = readResult.value.content.split('\\n');
    const { insert_line, new_str } = input;
    
    // Validate line number
    if (insert_line < 0 || insert_line > lines.length) {
      return `Error: Invalid line number ${insert_line}. File has ${lines.length} lines`;
    }
    
    // Insert at beginning (line 0)
    if (insert_line === 0) {
      lines.unshift(new_str);
    } else {
      // Insert after specified line
      lines.splice(insert_line, 0, new_str);
    }
    
    // Write back
    const newContent = lines.join('\\n');
    const writeResult = await fileSystemService.write(fullPath, newContent);
    if (!writeResult.ok) {
      const error = /** @type {{ok: false, error: Error}} */ (writeResult);
      return `Error: ${error.error.message}`;
    }
    
    return `Successfully inserted text at line ${insert_line}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * Check if an editor command is dangerous (for max mode auto-approval)
 * @param {TextEditorCommand} input - Editor command to check
 * @returns {boolean} Whether command is considered dangerous
 */
export function isEditorCommandDangerous(input) {
  // Only view commands are considered safe for auto-approval
  if (input.command === 'view') {
    return false;
  }
  
  // All modifications require approval
  return true;
}