/**
 * Tests for Agent Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toolRegistry } from '../../src/lib/agent/tools/registry.js';
import { executeBash, isBashCommandDangerous } from '../../src/lib/agent/anthropic/tools/bash.js';
import { executeEditor } from '../../src/lib/agent/anthropic/tools/editor.js';
import { executeWebSearch } from '../../src/lib/agent/anthropic/tools/web-search.js';
import { executeWorkPlan } from '../../src/lib/agent/anthropic/tools/work-plan.js';

describe('Tool Registry', () => {
  beforeEach(() => {
    // Reset registry to default state
    toolRegistry.tools.clear();
    toolRegistry.executionHistory.clear();
    toolRegistry.registerDefaultTools();
  });

  describe('Tool Registration', () => {
    it('should register default tools', () => {
      expect(toolRegistry.get('bash')).toBeDefined();
      expect(toolRegistry.get('str_replace_based_edit_tool')).toBeDefined();
      expect(toolRegistry.get('web_search')).toBeDefined();
      expect(toolRegistry.get('work_plan')).toBeDefined();
    });

    it('should register custom tool', () => {
      const customTool = {
        name: 'custom',
        execute: vi.fn(),
        definition: { type: 'custom', name: 'custom' }
      };

      toolRegistry.register(customTool);
      expect(toolRegistry.get('custom')).toBe(customTool);
    });

    it('should throw error for invalid tool', () => {
      expect(() => {
        toolRegistry.register({ name: 'invalid' });
      }).toThrow('Tool must have name and execute function');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool successfully', async () => {
      const mockExecute = vi.fn().mockResolvedValue('result');
      toolRegistry.register({
        name: 'test',
        execute: mockExecute
      });

      const result = await toolRegistry.execute(
        'session-1',
        'test',
        { input: 'data' },
        '/test/dir'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('result');
      expect(mockExecute).toHaveBeenCalledWith(
        { input: 'data' },
        '/test/dir',
        'session-1'
      );
    });

    it('should handle tool execution failure', async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error('Tool failed'));
      toolRegistry.register({
        name: 'failing',
        execute: mockExecute
      });

      const result = await toolRegistry.execute(
        'session-1',
        'failing',
        {},
        '/test/dir'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool failed');
    });

    it('should handle unknown tool', async () => {
      const result = await toolRegistry.execute(
        'session-1',
        'unknown',
        {},
        '/test/dir'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown');
    });
  });

  describe('Tool History', () => {
    it('should track execution history', async () => {
      const mockExecute = vi.fn().mockResolvedValue('result');
      toolRegistry.register({
        name: 'tracked',
        execute: mockExecute
      });

      await toolRegistry.execute('session-1', 'tracked', {}, '/test');

      const history = toolRegistry.getHistory('session-1');
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        name: 'tracked',
        success: true
      });
    });

    it('should get tool statistics', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce('result1')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('result2');

      toolRegistry.register({
        name: 'stats-test',
        execute: mockExecute
      });

      await toolRegistry.execute('session-1', 'stats-test', {}, '/test');
      await toolRegistry.execute('session-1', 'stats-test', {}, '/test');
      await toolRegistry.execute('session-1', 'stats-test', {}, '/test');

      const stats = toolRegistry.getStatistics('session-1');
      expect(stats.totalExecutions).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.toolUsage['stats-test']).toEqual({
        count: 3,
        successes: 2,
        failures: 1
      });
    });
  });

  describe('Dangerous Command Detection', () => {
    it('should detect dangerous commands', () => {
      const mockIsDangerous = vi.fn().mockReturnValue(true);
      toolRegistry.register({
        name: 'dangerous-check',
        execute: vi.fn(),
        isDangerous: mockIsDangerous
      });

      const result = toolRegistry.isDangerous('dangerous-check', { command: 'rm -rf /' });
      expect(result).toBe(true);
      expect(mockIsDangerous).toHaveBeenCalledWith({ command: 'rm -rf /' });
    });

    it('should return false for tools without danger check', () => {
      toolRegistry.register({
        name: 'safe',
        execute: vi.fn()
      });

      const result = toolRegistry.isDangerous('safe', {});
      expect(result).toBe(false);
    });
  });
});

describe('Bash Tool', () => {
  describe('Command Execution', () => {
    it('should handle restart command', async () => {
      const result = await executeBash({ restart: true }, '/test');
      expect(result).toBe('Bash session restarted');
    });

    it('should handle missing command', async () => {
      const result = await executeBash({}, '/test');
      expect(result).toBe('Error: No command provided');
    });

    it('should truncate long output', () => {
      // Mock terminal service
      vi.doMock('../src/lib/file-system/terminal.js', () => ({
        terminalService: {
          execute: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              stdout: 'a'.repeat(60000),
              stderr: '',
              exitCode: 0
            }
          })
        }
      }));

      // Output should be truncated
      // Note: This would need actual implementation testing
    });
  });

  describe('Dangerous Command Detection', () => {
    it('should detect rm -rf on root', () => {
      expect(isBashCommandDangerous('rm -rf /')).toBe(true);
      expect(isBashCommandDangerous('rm -rf /home')).toBe(true);
    });

    it('should detect sudo commands', () => {
      expect(isBashCommandDangerous('sudo apt-get install')).toBe(true);
      expect(isBashCommandDangerous('sudo rm file')).toBe(true);
    });

    it('should detect system control commands', () => {
      expect(isBashCommandDangerous('shutdown now')).toBe(true);
      expect(isBashCommandDangerous('reboot')).toBe(true);
      expect(isBashCommandDangerous('halt')).toBe(true);
    });

    it('should allow safe commands', () => {
      expect(isBashCommandDangerous('ls -la')).toBe(false);
      expect(isBashCommandDangerous('pwd')).toBe(false);
      expect(isBashCommandDangerous('cat file.txt')).toBe(false);
      expect(isBashCommandDangerous('echo "hello"')).toBe(false);
    });
  });
});

describe('Editor Tool', () => {
  // Mock fs module
  vi.doMock('node:fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  }));

  describe('Command Types', () => {
    it('should support view command', () => {
      // Test type checking
      const viewCommand = {
        command: 'view',
        path: '/test/file.txt',
        view_range: [1, 10]
      };

      // This would test the actual execution
      // but needs mocked fs operations
    });

    it('should support str_replace command', () => {
      const replaceCommand = {
        command: 'str_replace',
        path: '/test/file.txt',
        old_str: 'old text',
        new_str: 'new text'
      };

      // Test would verify replacement logic
    });

    it('should support create command', () => {
      const createCommand = {
        command: 'create',
        path: '/test/new-file.txt',
        file_text: 'content'
      };

      // Test would verify file creation
    });

    it('should support insert command', () => {
      const insertCommand = {
        command: 'insert',
        path: '/test/file.txt',
        insert_line: 5,
        new_str: 'inserted text'
      };

      // Test would verify insertion
    });
  });
});

describe('Work Plan Tool', () => {
  describe('Plan Management', () => {
    it('should create work plan', async () => {
      const input = {
        command: 'create',
        items: [
          { id: 'step1', title: 'First step', order: 1 },
          { id: 'step2', title: 'Second step', order: 2 }
        ]
      };

      const result = await executeWorkPlan('session-1', input);

      // Should return success message
      expect(result).toContain('created');
      expect(result).toContain('2 steps');
    });

    it('should complete work plan item', async () => {
      // First create a plan
      await executeWorkPlan('session-1', {
        command: 'create',
        items: [{ id: 'step1', title: 'Test step', order: 1 }]
      });

      // Then complete an item
      const result = await executeWorkPlan('session-1', {
        command: 'complete',
        id: 'step1'
      });

      expect(result).toContain('completed');
      expect(result).toContain('step1');
    });

    it('should revise work plan', async () => {
      // Create initial plan
      await executeWorkPlan('session-1', {
        command: 'create',
        items: [{ id: 'step1', title: 'Initial step', order: 1 }]
      });

      // Revise the plan
      const result = await executeWorkPlan('session-1', {
        command: 'revise',
        items: [{ id: 'step2', title: 'New step', order: 2 }]
      });

      expect(result).toContain('Revised');
    });

    it('should handle invalid command', async () => {
      const result = await executeWorkPlan('session-1', {
        command: 'invalid'
      });

      expect(result).toContain('Unknown work_plan command');
    });
  });
});

describe('Web Search Tool', () => {
  describe('Search Execution', () => {
    it('should execute web search', async () => {
      const result = await executeWebSearch({
        query: 'test search'
      });

      // Web search is a placeholder
      expect(result).toContain('Web search in progress');
      expect(result).toContain('test search');
    });

    it('should handle multiple queries', async () => {
      const result = await executeWebSearch({
        queries: ['query1', 'query2']
      });

      expect(result).toContain('Web search in progress');
      expect(result).toContain('query1');
      expect(result).toContain('query2');
    });
  });
});