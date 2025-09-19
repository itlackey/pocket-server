/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	try {
		// Mock terminal sessions data for now
		// In a full implementation, this would connect to the terminal manager
		const sessions = [
			{
				id: 'term-1',
				title: 'Main Terminal',
				cwd: '/home/user',
				cols: 80,
				rows: 24,
				active: true,
				createdAt: new Date().toISOString(),
				ownerClientId: 'client-1',
				ownerDeviceId: 'device-1',
				lastAttachedAt: new Date().toISOString()
			}
		];

		return new Response(JSON.stringify({ sessions }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}