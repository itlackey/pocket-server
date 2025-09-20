<!--
	Terminal Manager Component
	Provides terminal session management and interaction using Svelte 5 runes with WebSocket
-->
<script>
	import { onMount } from 'svelte';
	import { wsManager } from '$lib/stores/websocket.svelte.js';

	let sessions = $state([]);
	let selectedSession = $state(null);
	let terminalOutput = $state('');
	let command = $state('');
	let isLoading = $state(false);
	let error = $state(null);
	let wsConnected = $state(false);
	let currentTerminalId = $state(null);

	// Derive a browser-safe default working directory
	const defaultTerminalCwd = typeof process !== 'undefined' && process?.env?.HOME
		? process.env.HOME
		: '/home';

	// Track WebSocket connection status
	$effect(() => {
		wsConnected = wsManager.connected.value;
	});

	// Track processed message IDs to avoid infinite loops
	let processedMessageIds = new Set();

	// Listen for WebSocket messages
	$effect(() => {
		const messages = wsManager.messages.value;
		const latestMessage = messages[0];

		if (latestMessage && latestMessage.type?.startsWith('term:') && !processedMessageIds.has(latestMessage.id)) {
			processedMessageIds.add(latestMessage.id);
			handleTerminalMessage(latestMessage);
		}
	});

	/**
	 * Handle incoming terminal WebSocket messages
	 */
	function handleTerminalMessage(message) {
		const { type, payload } = message;

		switch (type) {
			case 'term:frame':
				if (payload?.id === currentTerminalId && payload?.data) {
					terminalOutput += payload.data;
				}
				break;
			case 'term:opened':
				if (payload?.id) {
					currentTerminalId = payload.id;
					terminalOutput = `Terminal session ${payload.id} opened\n`;
					// Add session to local list instead of reloading from API
					const newSession = {
						id: payload.id,
						title: payload.id,
						cwd: payload.cwd || '/home',
						cols: payload.cols || 80,
						rows: payload.rows || 24,
						active: true
					};
					sessions = [...sessions, newSession];
				}
				break;
			case 'term:attached':
				if (payload?.id) {
					currentTerminalId = payload.id;
					terminalOutput = `Attached to terminal session ${payload.id}\n`;
				}
				break;
			case 'term:resized':
				console.log('Terminal resized:', payload);
				break;
		}
	}

	/**
	 * Load terminal sessions from API
	 */
	async function loadSessions() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch('/api/terminal/sessions');
			if (response.ok) {
				const data = await response.json();
				sessions = data.sessions || [];
			} else {
				error = `Failed to load sessions: ${response.status}`;
			}
		} catch (e) {
			error = `Error loading sessions: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Create a new terminal session via WebSocket
	 */
	async function createSession() {
		if (!wsConnected) {
			error = 'WebSocket not connected. Please connect first.';
			return;
		}

		isLoading = true;
		error = null;

		try {
			const sessionId = crypto.randomUUID();
			const sent = wsManager.send({
				type: 'term:open',
				sessionId: sessionId,
				payload: {
					id: sessionId,
					cwd: defaultTerminalCwd,
					cols: 80,
					rows: 24
				}
			});

			if (sent) {
				selectedSession = sessionId;
				currentTerminalId = sessionId;
				// Session will be added to list when we get term:opened response
			} else {
				error = 'Failed to send terminal creation message';
			}
		} catch (e) {
			error = `Error creating session: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Execute command in selected terminal via WebSocket
	 */
	async function executeCommand() {
		console.log('executeCommand called', { selectedSession, command, wsConnected });

		if (!selectedSession || !command.trim() || !wsConnected) {
			console.log('executeCommand conditions not met', {
				hasSession: !!selectedSession,
				hasCommand: !!command.trim(),
				wsConnected
			});
			return;
		}

		try {
			// Add the command to output immediately to show user input
			terminalOutput += `$ ${command}\n`;

			// Send the command to the terminal via WebSocket
			console.log('Sending WebSocket message', {
				type: 'term:input',
				sessionId: selectedSession,
				payload: {
					id: currentTerminalId || selectedSession,
					data: command.trim() + '\n',
					seq: Date.now()
				}
			});

			const sent = wsManager.send({
				type: 'term:input',
				sessionId: selectedSession,
				payload: {
					id: currentTerminalId || selectedSession,
					data: command.trim() + '\n',
					seq: Date.now()
				}
			});

			if (sent) {
				command = '';
				console.log('Command sent successfully');
			} else {
				error = 'Failed to send command to terminal';
				console.error('Failed to send command');
			}
		} catch (e) {
			error = `Error executing command: ${e.message}`;
			console.error('Execute command error:', e);
		}
	}

	/**
	 * Select a terminal session and attach to it via WebSocket
	 */
	function selectSession(sessionId) {
		selectedSession = sessionId;
		currentTerminalId = sessionId;
		terminalOutput = ''; // Clear output before attaching

		if (wsConnected) {
			wsManager.send({
				type: 'term:attach',
				sessionId: sessionId,
				payload: {
					id: sessionId
				}
			});
		} else {
			terminalOutput = `Session ${sessionId} selected (WebSocket not connected)\n`;
		}
	}

	/**
	 * Close terminal session
	 */
	async function closeSession(sessionId) {
		try {
			await fetch(`/api/terminal/sessions/${sessionId}`, { method: 'DELETE' });
			await loadSessions();
			if (selectedSession === sessionId) {
				selectedSession = null;
				terminalOutput = '';
			}
		} catch (e) {
			error = `Error closing session: ${e.message}`;
		}
	}

	/**
	 * Handle keyboard shortcuts
	 */
	function handleKeydown(event) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			executeCommand();
		}
	}

	/**
	 * Connect to WebSocket if needed
	 */
	function connectWebSocket() {
		console.log('connectWebSocket called', { wsConnected });
		if (!wsConnected) {
			console.log('Attempting to connect to WebSocket');
			wsManager.connect('ws://localhost:3000/ws');
		} else {
			console.log('WebSocket already connected');
		}
	}

	onMount(() => {
		loadSessions();
		connectWebSocket();
	});
</script>

<div class="terminal-manager">
	<div class="terminal-header">
		<h2>🖥️ Terminal Manager</h2>
		<div class="terminal-status">
			<span class="websocket-status" class:connected={wsConnected}>
				{wsConnected ? '🟢 WebSocket Connected' : '🔴 WebSocket Disconnected'}
			</span>
		</div>
		<div class="terminal-actions">
			{#if !wsConnected}
				<button
					class="btn btn-warning"
					onclick={connectWebSocket}
					disabled={isLoading}
				>
					🔌 Connect WebSocket
				</button>
			{/if}
			<button
				class="btn btn-primary"
				onclick={createSession}
				disabled={isLoading || !wsConnected}
			>
				➕ New Session
			</button>
			<button
				class="btn btn-secondary"
				onclick={loadSessions}
				disabled={isLoading}
			>
				🔄 Refresh
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-banner">
			<span class="error-icon">⚠️</span>
			<span class="error-message">{error}</span>
			<button class="error-dismiss" onclick={() => error = null}>✕</button>
		</div>
	{/if}

	<div class="terminal-content">
		<!-- Sessions Panel -->
		<div class="sessions-panel">
			<h3>Active Sessions</h3>
			{#if isLoading && sessions.length === 0}
				<div class="loading">Loading sessions...</div>
			{:else if sessions.length === 0}
				<div class="empty-state">
					<p>No active terminal sessions</p>
					<p class="empty-hint">Create a new session to get started</p>
				</div>
			{:else}
				<div class="sessions-list">
					{#each sessions as session}
						<div 
							class="session-item"
							class:active={selectedSession === session.id}
							onclick={() => selectSession(session.id)}
						>
							<div class="session-info">
								<div class="session-title">{session.title || session.id}</div>
								<div class="session-details">
									<span class="session-cwd">{session.cwd}</span>
									<span class="session-size">{session.cols}×{session.rows}</span>
									<span class="session-status" class:active={session.active}>
										{session.active ? '🟢' : '🔴'}
									</span>
								</div>
							</div>
							<button 
								class="session-close"
								onclick={(e) => { e.stopPropagation(); closeSession(session.id); }}
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Terminal Panel -->
		<div class="terminal-panel">
			{#if selectedSession}
				<div class="terminal-display">
					<div class="terminal-output">
						<pre>{terminalOutput}</pre>
					</div>
					<div class="terminal-input">
						<div class="input-group">
							<span class="input-prompt">$</span>
							<input
								type="text"
								bind:value={command}
								onkeydown={handleKeydown}
								placeholder={wsConnected ? "Enter command (Ctrl+Enter to execute)" : "WebSocket not connected"}
								disabled={isLoading || !wsConnected}
								class="command-input"
							/>
							<button
								class="btn btn-primary"
								onclick={executeCommand}
								disabled={isLoading || !command.trim() || !wsConnected}
							>
								Execute
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="no-session">
					<div class="no-session-content">
						<div class="no-session-icon">🖥️</div>
						<h3>No Terminal Selected</h3>
						<p>Select a session from the left panel or create a new one</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.terminal-manager {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		overflow: hidden;
	}

	.terminal-header {
		background: #2d3748;
		color: white;
		padding: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.terminal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.terminal-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #4299e1;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #3182ce;
	}

	.btn-secondary {
		background: #718096;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #4a5568;
	}

	.btn-warning {
		background: #ed8936;
		color: white;
	}

	.btn-warning:hover:not(:disabled) {
		background: #dd6b20;
	}

	.terminal-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.websocket-status {
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.1);
	}

	.websocket-status.connected {
		background: rgba(72, 187, 120, 0.2);
	}

	.error-banner {
		background: #fed7d7;
		color: #c53030;
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.error-message {
		flex: 1;
	}

	.error-dismiss {
		background: none;
		border: none;
		color: #c53030;
		cursor: pointer;
		font-size: 1rem;
		padding: 0;
	}

	.terminal-content {
		display: grid;
		grid-template-columns: 1fr 2fr;
		min-height: 500px;
	}

	.sessions-panel {
		border-right: 1px solid #e2e8f0;
		background: #f7fafc;
	}

	.sessions-panel h3 {
		margin: 0;
		padding: 1rem;
		background: #edf2f7;
		font-size: 1rem;
		font-weight: 600;
		color: #2d3748;
		border-bottom: 1px solid #e2e8f0;
	}

	.loading, .empty-state {
		padding: 2rem 1rem;
		text-align: center;
		color: #718096;
	}

	.empty-hint {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.sessions-list {
		padding: 0.5rem;
	}

	.session-item {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		background: white;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		border: 2px solid transparent;
	}

	.session-item:hover {
		background: #f1f5f9;
	}

	.session-item.active {
		border-color: #4299e1;
		background: #ebf8ff;
	}

	.session-info {
		flex: 1;
	}

	.session-title {
		font-weight: 600;
		color: #2d3748;
		margin-bottom: 0.25rem;
	}

	.session-details {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.75rem;
		color: #718096;
	}

	.session-close {
		background: none;
		border: none;
		color: #718096;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.session-close:hover {
		background: #fed7d7;
		color: #c53030;
	}

	.terminal-panel {
		background: #1a202c;
		color: #e2e8f0;
		display: flex;
		flex-direction: column;
	}

	.terminal-display {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.terminal-output {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		background: #000;
		color: #00ff00;
	}

	.terminal-output pre {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.terminal-input {
		padding: 1rem;
		border-top: 1px solid #4a5568;
		background: #2d3748;
	}

	.input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.input-prompt {
		color: #68d391;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-weight: 600;
	}

	.command-input {
		flex: 1;
		padding: 0.5rem;
		background: #1a202c;
		border: 1px solid #4a5568;
		border-radius: 4px;
		color: #e2e8f0;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
	}

	.command-input:focus {
		outline: none;
		border-color: #4299e1;
	}

	.no-session {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: #2d3748;
	}

	.no-session-content {
		text-align: center;
		color: #a0aec0;
	}

	.no-session-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.no-session-content h3 {
		margin: 0 0 0.5rem 0;
		color: #e2e8f0;
	}

	.no-session-content p {
		margin: 0;
		font-size: 0.875rem;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.terminal-content {
			grid-template-columns: 1fr;
		}

		.sessions-panel {
			border-right: none;
			border-bottom: 1px solid #e2e8f0;
		}

		.terminal-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.terminal-actions {
			justify-content: center;
		}
	}
</style>
