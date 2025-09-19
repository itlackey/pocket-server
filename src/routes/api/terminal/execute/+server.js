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

		// Mock command execution
		// In a full implementation, this would execute the command in the PTY session
		const mockOutput = `Executed: ${command}\nMock output for demonstration\n`;
		
		return new Response(JSON.stringify({ 
			output: mockOutput,
			exitCode: 0
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