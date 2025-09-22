/**
 * Agent chat endpoint for real-time conversation
 * Handles streaming conversations with Claude
 */

import { json } from '@sveltejs/kit';
import { anthropicService } from '$lib/agent/anthropic/service.js';

/**
 * Handle agent conversation message
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const { sessionId, content, workingDir, maxMode, apiKey } = body || {};
		
		if (!sessionId) {
			return json({ error: 'Session ID is required' }, { status: 400 });
		}
		
		if (!content) {
			return json({ error: 'Message content is required' }, { status: 400 });
		}
		
		if (!apiKey) {
			return json({ error: 'API key is required' }, { status: 400 });
		}
		
		// Collect messages for streaming response
		const messages = [];
		
		// Process message with streaming
		await anthropicService.processMessage(
			{
				type: 'agent:message',
				sessionId,
				content,
				workingDir,
				maxMode
			},
			apiKey,
			(message) => {
				messages.push(message);
			}
		);
		
		// Return all collected messages
		return json({ 
			success: true,
			messages,
			sessionId
		});
		
	} catch (error) {
		console.error('[Agent Chat] Error:', error);
		return json(
			{ error: error.message },
			{ status: 500 }
		);
	}
}