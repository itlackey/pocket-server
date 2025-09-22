import { terminalManager } from '$lib/terminal/state.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { sessionId, command } = body;

		if (!sessionId || !command) {
			return new Response(JSON.stringify({ error: 'sessionId and command are required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Check if session exists
		const session = terminalManager.get(sessionId);
		if (!session) {
			return new Response(JSON.stringify({ error: 'Terminal session not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Execute command in terminal session
		// Add newline to actually execute the command
		const commandWithNewline = command.endsWith('\n') ? command : command + '\n';
		terminalManager.write(sessionId, commandWithNewline);
		
		return new Response(JSON.stringify({ 
			success: true,
			message: `Command sent to terminal ${sessionId}`,
			command: command
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
