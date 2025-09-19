/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { cwd = '/home', cols = 80, rows = 24 } = body;

		// Mock terminal session creation
		// In a full implementation, this would create a new PTY session
		const sessionId = `term-${Date.now()}`;
		
		return new Response(JSON.stringify({ 
			id: sessionId,
			cwd,
			cols,
			rows,
			created: true
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