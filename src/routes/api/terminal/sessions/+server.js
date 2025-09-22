import { terminalManager, terminalRegistry } from '$lib/terminal/state.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	try {
		// Get all registered terminal sessions
		const registryEntries = terminalRegistry.list();
		
		// Enhance with current terminal manager state
		const sessions = registryEntries.map((entry) => {
			const session = terminalManager.get(entry.id);
			const active = !!session && entry.active !== false;
			
			return {
				id: entry.id,
				title: entry.title,
				cwd: entry.cwd,
				createdAt: entry.createdAt,
				cols: session?.cols ?? entry.cols,
				rows: session?.rows ?? entry.rows,
				active,
				ownerClientId: entry.ownerClientId,
				ownerDeviceId: entry.ownerDeviceId,
				lastAttachedAt: entry.lastAttachedAt,
			};
		});

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
