<!--
	WebSocket Monitor Component
	Manages WebSocket connection and displays real-time messages
-->
<script>
	import { wsManager } from '$lib/stores/websocket.svelte.js';
	import { onMount } from 'svelte';

	let wsUrl = $state('ws://localhost:3000/ws');
	let messageInput = $state('');
	let messageType = $state('ping');
	let sessionId = $state('default');
	let pingInterval = $state(null);
	let autoPing = $state(false);

	// Reactive computed for connection status display
	const connectionStatus = $derived(() => {
		return wsManager.connected.value ? 'Connected' : 'Disconnected';
	});

	// Reactive computed for last ping display
	const lastPingDisplay = $derived(() => {
		if (!wsManager.lastPing.value) return 'Never';
		const ago = Date.now() - wsManager.lastPing.value;
		return `${Math.floor(ago / 1000)}s ago`;
	});

	function connect() {
		wsManager.connect(wsUrl);
	}

	function disconnect() {
		wsManager.disconnect();
		stopAutoPing();
	}

	function sendMessage() {
		if (!messageInput.trim()) return;

		let payload = {};
		try {
			payload = messageInput.trim() ? JSON.parse(messageInput) : {};
		} catch {
			payload = { text: messageInput };
		}

		const sent = wsManager.send({
			type: messageType,
			sessionId: sessionId,
			payload: payload
		});

		if (sent) {
			messageInput = '';
		}
	}

	function sendPing() {
		wsManager.ping();
	}

	function toggleAutoPing() {
		autoPing = !autoPing;
		if (autoPing) {
			startAutoPing();
		} else {
			stopAutoPing();
		}
	}

	function startAutoPing() {
		if (pingInterval) clearInterval(pingInterval);
		pingInterval = setInterval(() => {
			if (wsManager.connected.value) {
				wsManager.ping();
			}
		}, 10000); // Ping every 10 seconds
	}

	function stopAutoPing() {
		if (pingInterval) {
			clearInterval(pingInterval);
			pingInterval = null;
		}
	}

	function clearMessages() {
		wsManager.clearMessages();
	}

	function formatTimestamp(ts) {
		return new Date(ts).toLocaleTimeString();
	}

	function getMessageTypeColor(type) {
		if (type === 'ping' || type === 'pong') return '#4CAF50';
		if (type.startsWith('ws:')) return '#2196F3';
		if (type.startsWith('agent:')) return '#FF9800';
		if (type.startsWith('term:')) return '#9C27B0';
		if (type.startsWith('fs:')) return '#795548';
		return '#666';
	}

	onMount(() => {
		return () => {
			stopAutoPing();
		};
	});
</script>

<div class="websocket-panel">
	<div class="header">
		<h3>🔌 WebSocket Monitor</h3>
		<div class="connection-status" class:connected={wsManager.connected.value}>
			{connectionStatus()}
		</div>
	</div>

	<div class="connection-controls">
		<div class="input-group">
			<label for="ws-url">WebSocket URL:</label>
			<input 
				id="ws-url"
				bind:value={wsUrl} 
				placeholder="ws://localhost:3000/ws"
				disabled={wsManager.connected.value}
			/>
		</div>
		
		<div class="buttons">
			{#if wsManager.connected.value}
				<button onclick={disconnect} class="disconnect-btn">Disconnect</button>
			{:else}
				<button onclick={connect} class="connect-btn">Connect</button>
			{/if}
		</div>
	</div>

	{#if wsManager.connected.value}
		<div class="ping-controls">
			<button onclick={sendPing} class="ping-btn">Send Ping</button>
			<button onclick={toggleAutoPing} class="auto-ping-btn" class:active={autoPing}>
				{autoPing ? '⏸️ Stop Auto Ping' : '▶️ Start Auto Ping'}
			</button>
			<span class="last-ping">Last pong: {lastPingDisplay()}</span>
		</div>

		<div class="message-composer">
			<div class="composer-header">
				<h4>Send Message</h4>
			</div>
			<div class="composer-inputs">
				<div class="input-row">
					<select bind:value={messageType}>
						<option value="ping">ping</option>
						<option value="agent:start">agent:start</option>
						<option value="term:input">term:input</option>
						<option value="fs:read">fs:read</option>
						<option value="custom">custom</option>
					</select>
					<input 
						bind:value={sessionId} 
						placeholder="Session ID"
						class="session-input"
					/>
				</div>
				<textarea 
					bind:value={messageInput}
					placeholder="Message payload (JSON or text)"
					rows="3"
				></textarea>
				<button onclick={sendMessage} disabled={!wsManager.connected.value}>
					Send Message
				</button>
			</div>
		</div>
	{/if}

	<div class="messages-section">
		<div class="messages-header">
			<h4>Messages ({wsManager.messages.value.length})</h4>
			<button onclick={clearMessages} class="clear-btn">Clear</button>
		</div>
		
		<div class="messages-list">
			{#each wsManager.messages.value as message, i (message.id || i)}
				<div class="message" class:outgoing={false}>
					<div class="message-header">
						<span 
							class="message-type" 
							style="color: {getMessageTypeColor(message.type)}"
						>
							{message.type}
						</span>
						<span class="message-time">{formatTimestamp(message.ts)}</span>
						{#if message.sessionId && message.sessionId !== 'system'}
							<span class="session-id">#{message.sessionId}</span>
						{/if}
					</div>
					<div class="message-content">
						<pre>{JSON.stringify(message.payload, null, 2)}</pre>
					</div>
				</div>
			{/each}
			
			{#if wsManager.messages.value.length === 0}
				<div class="no-messages">No messages yet</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.websocket-panel {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1rem;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		display: flex;
		flex-direction: column;
		height: 600px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		border-bottom: 1px solid #f0f0f0;
		padding-bottom: 0.5rem;
	}

	.header h3 {
		margin: 0;
		color: #333;
		font-size: 1.1rem;
	}

	.connection-status {
		padding: 0.25rem 0.75rem;
		border-radius: 16px;
		font-size: 0.8rem;
		font-weight: 600;
		background: #ffebee;
		color: #c62828;
	}

	.connection-status.connected {
		background: #e8f5e8;
		color: #2e7d32;
	}

	.connection-controls {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1rem;
	}

	.input-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.input-group label {
		font-size: 0.9rem;
		color: #666;
		font-weight: 500;
	}

	.input-group input {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
	}

	.connect-btn, .disconnect-btn, .ping-btn, .auto-ping-btn, .clear-btn {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.connect-btn {
		background: #4CAF50;
		color: white;
		border-color: #4CAF50;
	}

	.disconnect-btn {
		background: #f44336;
		color: white;
		border-color: #f44336;
	}

	.ping-btn:hover, .auto-ping-btn:hover, .clear-btn:hover {
		background: #f5f5f5;
		border-color: #999;
	}

	.auto-ping-btn.active {
		background: #FF9800;
		color: white;
		border-color: #FF9800;
	}

	.ping-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.last-ping {
		font-size: 0.8rem;
		color: #666;
		margin-left: auto;
	}

	.message-composer {
		margin-bottom: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
	}

	.composer-header {
		background: #f5f5f5;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.composer-header h4 {
		margin: 0;
		font-size: 0.9rem;
		color: #333;
	}

	.composer-inputs {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.input-row select, .session-input {
		padding: 0.4rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.session-input {
		flex: 1;
		font-family: 'Courier New', monospace;
	}

	.composer-inputs textarea {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		resize: vertical;
	}

	.composer-inputs button {
		padding: 0.5rem 1rem;
		background: #2196F3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		align-self: flex-start;
	}

	.composer-inputs button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.messages-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.messages-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.messages-header h4 {
		margin: 0;
		font-size: 0.9rem;
		color: #333;
	}

	.messages-list {
		flex: 1;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 0.5rem;
		background: #fafafa;
	}

	.message {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		margin-bottom: 0.5rem;
		overflow: hidden;
	}

	.message-header {
		background: #f5f5f5;
		padding: 0.25rem 0.5rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.8rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.message-type {
		font-weight: 600;
		font-family: 'Courier New', monospace;
	}

	.message-time {
		color: #666;
	}

	.session-id {
		background: #e3f2fd;
		color: #1976d2;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-family: 'Courier New', monospace;
	}

	.message-content {
		padding: 0.5rem;
	}

	.message-content pre {
		margin: 0;
		font-size: 0.8rem;
		color: #333;
		background: none;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.no-messages {
		text-align: center;
		color: #666;
		font-style: italic;
		padding: 2rem;
	}
</style>