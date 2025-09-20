import { TerminalManager } from './terminal-manager.js';
import { TerminalRegistry } from './registry.js';

const globalKeyManager = '__pocket_terminal_manager';
const globalKeyRegistry = '__pocket_terminal_registry';

/**
 * Share singleton instances across the server runtime, even with HMR.
 */
const terminalManager = globalThis[globalKeyManager] ?? new TerminalManager();
const terminalRegistry = globalThis[globalKeyRegistry] ?? new TerminalRegistry();

if (!globalThis[globalKeyManager]) {
	globalThis[globalKeyManager] = terminalManager;
}

if (!globalThis[globalKeyRegistry]) {
	globalThis[globalKeyRegistry] = terminalRegistry;
}

export { terminalManager, terminalRegistry };
