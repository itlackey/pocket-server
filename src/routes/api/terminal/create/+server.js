import { TerminalManager } from '$lib/terminal/terminal-manager.js';
import { TerminalRegistry } from '$lib/terminal/registry.js';

// Create singleton instances
const terminalManager = new TerminalManager();
const terminalRegistry = new TerminalRegistry();

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { cwd = process.cwd(), cols = 80, rows = 24, title } = body;

		// Create a new terminal session
		const sessionId = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		// Open the terminal session
		const session = terminalManager.open(sessionId, cwd, rows, cols);
		
		// Register the session
		terminalRegistry.upsert({
			id: sessionId,
			title: title || `Terminal ${sessionId}`,
			cwd: session.cwd,
			cols: session.cols,
			rows: session.rows,
			active: true,
			createdAt: new Date(session.createdAt).toISOString(),
			ownerClientId: null, // Will be set when WebSocket connects
			ownerDeviceId: null,
			lastAttachedAt: new Date().toISOString()
		});
		
		return new Response(JSON.stringify({ 
			id: sessionId,
			cwd: session.cwd,
			cols: session.cols,
			rows: session.rows,
			created: true,
			createdAt: new Date(session.createdAt).toISOString()
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}