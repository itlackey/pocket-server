import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';

// Custom plugin to add WebSocket support in dev mode
function webSocketPlugin() {
	return {
		name: 'websocket',
		configureServer(server) {
			if (!server.httpServer) return;
			
			const wss = new WebSocketServer({ 
				server: server.httpServer,
				path: '/ws'
			});

			wss.on('connection', (ws, req) => {
				const clientId = crypto.randomUUID();
				console.log(`WebSocket client connected: ${clientId}`);

				ws.on('message', (data) => {
					try {
						const message = JSON.parse(data.toString());
						console.log('WebSocket message:', message.type);
						
						// Handle ping/pong
						if (message.type === 'ping') {
							ws.send(JSON.stringify({
								v: 1,
								id: crypto.randomUUID(),
								sessionId: message.sessionId || 'system',
								ts: new Date().toISOString(),
								type: 'pong',
								payload: {},
								timestamp: Date.now(),
								correlationId: message.id
							}));
						}
					} catch (error) {
						console.error('WebSocket error:', error);
					}
				});

				ws.on('close', () => {
					console.log(`WebSocket client disconnected: ${clientId}`);
				});

				// Send welcome message
				ws.send(JSON.stringify({
					v: 1,
					id: crypto.randomUUID(),
					sessionId: 'system',
					ts: new Date().toISOString(),
					type: 'ws:connected',
					payload: { clientId },
					timestamp: Date.now()
				}));
			});
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), webSocketPlugin()],
	server: {
		// Support for the dev server
		port: 3000
	},
	define: {
		// Enable process.env for compatibility with existing code
		global: 'globalThis'
	}
});