import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

// Custom plugin to add WebSocket support in dev mode
function webSocketPlugin() {
	return {
		name: 'websocket',
		configureServer(server) {
			if (!server.httpServer) return;

			const wss = new WebSocketServer({ noServer: true });

			const upgradeHandler = (request, socket, head) => {
				if (!request.url) return;

				const { pathname } = new URL(request.url, 'http://localhost');
				if (pathname !== '/ws') return; // let Vite handle its own upgrade paths

				wss.handleUpgrade(request, socket, head, (ws) => {
					wss.emit('connection', ws, request);
				});
			};

			server.httpServer.on('upgrade', upgradeHandler);

			const closeHandler = () => {
				server.httpServer?.off('upgrade', upgradeHandler);
				wss.clients.forEach((client) => client.close());
				wss.close();
			};

			server.httpServer.once('close', closeHandler);

			wss.on('connection', (ws) => {
				const clientId = randomUUID();
				console.log(`WebSocket client connected: ${clientId}`);

				ws.on('message', (data) => {
					try {
						const message = JSON.parse(data.toString());
						console.log('WebSocket message:', message.type);

						if (message.type === 'ping') {
							ws.send(JSON.stringify({
								v: 1,
								id: randomUUID(),
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

				ws.send(JSON.stringify({
					v: 1,
					id: randomUUID(),
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
