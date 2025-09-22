/**
 * WebSocket client store using Svelte 5 runes
 * Manages WebSocket connection state and message handling
 */

let websocket = $state(null);
let connected = $state(false);
let messages = $state([]);
let lastPing = $state(null);

/**
 * WebSocket manager class using modern Svelte 5 patterns
 */
export class WebSocketManager {
	constructor() {
		// Use getters to make the state reactive
		this.connected = {
			get value() { return connected; }
		};
		
		this.messages = {
			get value() { return messages; }
		};
		
		this.lastPing = {
			get value() { return lastPing; }
		};
	}

	/**
	 * Connect to WebSocket server
	 * @param {string} url - WebSocket URL
	 */
	connect(url = 'ws://localhost:3000/ws') {
		if (websocket?.readyState === WebSocket.OPEN) {
			return;
		}

		websocket = new WebSocket(url);
		
		websocket.onopen = () => {
			connected = true;
			console.log('WebSocket connected');
		};

		websocket.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				messages = [message, ...messages.slice(0, 99)]; // Keep last 100 messages
				
				if (message.type === 'pong') {
					lastPing = Date.now();
				}
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error);
			}
		};

		websocket.onclose = () => {
			connected = false;
			console.log('WebSocket disconnected');
		};

		websocket.onerror = (error) => {
			console.error('WebSocket error:', error);
			connected = false;
		};
	}

	/**
	 * Disconnect from WebSocket server
	 */
	disconnect() {
		if (websocket) {
			websocket.close();
			websocket = null;
			connected = false;
		}
	}

	/**
	 * Send a message through WebSocket
	 * @param {object} message - Message to send
	 */
	send(message) {
		if (websocket?.readyState === WebSocket.OPEN) {
			const fullMessage = {
				v: 1,
				id: crypto.randomUUID(),
				sessionId: message.sessionId || 'default',
				ts: new Date().toISOString(),
				timestamp: Date.now(),
				...message
			};
			
			websocket.send(JSON.stringify(fullMessage));
			return true;
		}
		return false;
	}

	/**
	 * Send a ping message
	 */
	ping() {
		return this.send({
			type: 'ping',
			payload: {}
		});
	}

	/**
	 * Clear message history
	 */
	clearMessages() {
		messages = [];
	}
}

// Export singleton instance
export const wsManager = new WebSocketManager();