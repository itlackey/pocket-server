<!--
	Agent Manager Component
	Provides AI agent session management and conversation interface using Svelte 5 runes
-->
<script>
	import { onMount } from 'svelte';

	// Props
	let {apiKey} = $props();

	let sessions = $state([]);
	let selectedSession = $state(null);
	let sessionSnapshot = $state(null);
	let message = $state('');
	let conversation = $state([]);
	let isLoading = $state(false);
	let error = $state(null);
	let isAutoRefresh = $state(false);
	let refreshInterval = $state(null);
	let isSending = $state(false);
	// Resolve default working directory without assuming Node globals exist in the browser
	const resolvedWorkingDir = typeof process !== 'undefined' && typeof process.cwd === 'function'
		? process.cwd()
		: '/home';
	let workingDir = $state(resolvedWorkingDir);
	let maxMode = $state(false);

	/**
	 * Load agent sessions from API
	 */
	async function loadSessions() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch('/api/agent/sessions');
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
	 * Create a new agent session
	 */
	async function createSession() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch('/api/agent/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					workingDir,
					maxMode,
					title: 'New Chat'
				})
			});
			
			if (response.ok) {
				const data = await response.json();
				await loadSessions();
				selectedSession = data.id;
				await loadSessionSnapshot(data.id);
			} else {
				error = `Failed to create session: ${response.status}`;
			}
		} catch (e) {
			error = `Error creating session: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Send message to agent
	 */
	async function sendMessage() {
		if (!selectedSession || !message.trim() || !apiKey.trim()) {
			if (!apiKey.trim()) {
				error = 'Please enter your Anthropic API key';
			}
			return;
		}
		
		isSending = true;
		error = null;
		const userMessage = message.trim();
		message = ''; // Clear input
		
		// Add user message to conversation
		conversation = [...conversation, {
			role: 'user',
			content: userMessage,
			timestamp: new Date().toISOString()
		}];
		
		try {
			const response = await fetch('/api/agent/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: selectedSession,
					content: userMessage,
					workingDir,
					maxMode,
					apiKey
				})
			});
			
			if (response.ok) {
				const data = await response.json();
				
				// Process streaming messages
				for (const msg of data.messages || []) {
					if (msg.type === 'agent:assistant') {
						// Add or update assistant response
						const lastMsg = conversation[conversation.length - 1];
						if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isComplete) {
							lastMsg.content += msg.content;
							lastMsg.isComplete = msg.isComplete;
						} else {
							conversation = [...conversation, {
								role: 'assistant',
								content: msg.content,
								timestamp: new Date().toISOString(),
								isComplete: msg.isComplete
							}];
						}
					} else if (msg.type === 'agent:title') {
						// Update session title
						await loadSessions();
					}
				}
			} else {
				error = `Failed to send message: ${response.status}`;
			}
		} catch (e) {
			error = `Error sending message: ${e.message}`;
		} finally {
			isSending = false;
		}
	}

	/**
	 * Load session snapshot
	 */
	async function loadSessionSnapshot(sessionId) {
		if (!sessionId) return;
		
		try {
			const response = await fetch(`/api/agent/snapshot?sessionId=${sessionId}`);
			if (response.ok) {
				const data = await response.json();
				sessionSnapshot = data;
				// Load conversation from snapshot
				if (data.conversation && data.conversation.messages) {
					conversation = data.conversation.messages.map(msg => ({
						...msg,
						timestamp: new Date().toISOString(),
						isComplete: true
					}));
				}
			} else {
				sessionSnapshot = null;
				conversation = [];
			}
		} catch (e) {
			console.error('Error loading session snapshot:', e);
			sessionSnapshot = null;
			conversation = [];
		}
	}

	/**
	 * Select session and load its data
	 */
	async function selectSession(sessionId) {
		selectedSession = sessionId;
		await loadSessionSnapshot(sessionId);
	}

	/**
	 * Update session title
	 */
	async function updateSessionTitle(sessionId, newTitle) {
		try {
			const response = await fetch('/api/agent/title', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					title: newTitle
				})
			});
			
			if (response.ok) {
				await loadSessions();
			}
		} catch (e) {
			error = `Error updating title: ${e.message}`;
		}
	}

	/**
	 * Clear session conversation
	 */
	async function clearSession(sessionId) {
		try {
			const response = await fetch('/api/agent/clear', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId })
			});
			
			if (response.ok) {
				await loadSessions();
				if (selectedSession === sessionId) {
					sessionSnapshot = null;
				}
			}
		} catch (e) {
			error = `Error clearing session: ${e.message}`;
		}
	}

	

	/**
	 * Toggle auto-refresh
	 */
	function toggleAutoRefresh() {
		isAutoRefresh = !isAutoRefresh;
		
		if (isAutoRefresh) {
			refreshInterval = setInterval(() => {
				loadSessions();
				if (selectedSession) {
					loadSessionSnapshot(selectedSession);
				}
			}, 5000);
		} else {
			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		}
	}

	/**
	 * Format timestamp
	 */
	function formatTimestamp(timestamp) {
		if (!timestamp) return 'Unknown';
		return new Date(timestamp).toLocaleString();
	}

	/**
	 * Get session status badge
	 */
	function getSessionStatus(session) {
		if (!session) return { label: 'Unknown', color: 'gray' };
		
		if (session.messages && session.messages.length > 0) {
			return { label: 'Active', color: 'green' };
		}
		return { label: 'New', color: 'blue' };
	}

	onMount(() => {
		loadSessions();
		
		return () => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
		};
	});
</script>

<div class="agent-manager">
	<div class="agent-header">
		<h2>🤖 Agent Manager</h2>
		<div class="agent-actions">
			<button 
				class="btn btn-primary" 
				onclick={createSession}
				disabled={isLoading}
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
			<button 
				class="btn"
				class:btn-success={isAutoRefresh}
				class:btn-secondary={!isAutoRefresh}
				onclick={toggleAutoRefresh}
			>
				{isAutoRefresh ? '⏸️ Auto' : '▶️ Auto'}
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

	<div class="agent-content">
		<!-- Sessions Panel -->
		<div class="sessions-panel">
			<h3>Agent Sessions</h3>
			{#if isLoading && sessions.length === 0}
				<div class="loading">Loading sessions...</div>
			{:else if sessions.length === 0}
				<div class="empty-state">
					<p>No agent sessions</p>
					<p class="empty-hint">Create a new session to start conversations</p>
				</div>
			{:else}
				<div class="sessions-list">
					{#each sessions as session}
						{@const status = getSessionStatus(session)}
						<div 
							class="session-item"
							class:active={selectedSession === session.id}
							onclick={() => selectSession(session.id)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									selectSession(session.id);
								}
							}}
							role="button"
							tabindex="0"
						>
							<div class="session-info">
								<div class="session-title">
									{session.title || `Session ${session.id.slice(0, 8)}`}
								</div>
								<div class="session-details">
									<span class="session-status status-{status.color}">
										{status.label}
									</span>
									<span class="session-time">
										{formatTimestamp(session.createdAt)}
									</span>
								</div>
								<div class="session-meta">
									<span class="session-dir">{session.workingDir}</span>
									{#if session.maxMode}
										<span class="max-mode-badge">MAX</span>
									{/if}
								</div>
							</div>
							<div class="session-actions">
								<button 
									class="action-btn"
									onclick={(e) => { e.stopPropagation(); updateSessionTitle(session.id, prompt('New title:', session.title)); }}
									title="Edit title"
								>
									✏️
								</button>
								<button 
									class="action-btn"
									onclick={(e) => { e.stopPropagation(); clearSession(session.id); }}
									title="Clear conversation"
								>
									🗑️
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Session Details Panel -->
		<div class="details-panel">
			{#if selectedSession && sessionSnapshot}
				<div class="session-details-view">
					<div class="session-header-info">
						<h3>{sessionSnapshot.title || `Session ${selectedSession.slice(0, 8)}`}</h3>
						<div class="session-stats">
							<span class="stat-item">
								💬 {sessionSnapshot.messages?.length || 0} messages
							</span>
							<span class="stat-item">
								📁 {sessionSnapshot.workingDir}
							</span>
							{#if sessionSnapshot.maxMode}
								<span class="stat-item max-mode">⚡ MAX MODE</span>
							{/if}
						</div>
					</div>

					{#if sessionSnapshot.messages && sessionSnapshot.messages.length > 0}
						<div class="conversation-view">
							<h4>Recent Conversation</h4>
							<div class="messages-container">
								{#each sessionSnapshot.messages.slice(-5) as message}
									<div class="message message-{message.role}">
										<div class="message-header">
											<span class="message-role">{message.role}</span>
											<span class="message-time">
												{formatTimestamp(message.timestamp)}
											</span>
										</div>
										<div class="message-content">
											{message.content.slice(0, 200)}
											{#if message.content.length > 200}
												<span class="message-truncated">...</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="no-messages">
							<div class="no-messages-content">
								<div class="no-messages-icon">💭</div>
								<h4>No Messages</h4>
								<p>This session hasn't started any conversations yet</p>
							</div>
						</div>
					{/if}

					<!-- Message Input (placeholder for future WebSocket integration) -->
					<div class="message-input-section">
						<h4>Send Message (Preview)</h4>
						<div class="message-input">
							<input 
								type="text" 
								bind:value={message}
								placeholder="Type a message to the agent..."
								onkeydown={(e) => e.key === 'Enter' && sendMessage()}
								class="message-field"
							/>
							<button 
								class="btn btn-primary"
								onclick={sendMessage}
								disabled={!message.trim()}
							>
								Send
							</button>
						</div>
						<p class="input-note">
							Note: Real-time messaging will be available when WebSocket agent integration is complete
						</p>
					</div>
				</div>
			{:else if selectedSession}
				<div class="loading-details">Loading session details...</div>
			{:else}
				<div class="no-session">
					<div class="no-session-content">
						<div class="no-session-icon">🤖</div>
						<h3>No Session Selected</h3>
						<p>Select a session from the left panel or create a new one</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.agent-manager {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		overflow: hidden;
	}

	.agent-header {
		background: #805ad5;
		color: white;
		padding: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.agent-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.agent-actions {
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

	.btn-success {
		background: #48bb78;
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background: #38a169;
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

	.agent-content {
		display: grid;
		grid-template-columns: 1fr 2fr;
		min-height: 600px;
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

	.loading, .empty-state, .loading-details {
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
		align-items: flex-start;
		padding: 1rem;
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
		border-color: #805ad5;
		background: #faf5ff;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-title {
		font-weight: 600;
		color: #2d3748;
		margin-bottom: 0.5rem;
		word-break: break-word;
	}

	.session-details {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
	}

	.session-status {
		padding: 0.125rem 0.5rem;
		border-radius: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.status-green {
		background: #c6f6d5;
		color: #22543d;
	}

	.status-blue {
		background: #bee3f8;
		color: #1a365d;
	}

	.status-gray {
		background: #e2e8f0;
		color: #4a5568;
	}

	.session-time {
		color: #718096;
	}

	.session-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.75rem;
		color: #718096;
	}

	.session-dir {
		font-family: monospace;
		background: #edf2f7;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
	}

	.max-mode-badge {
		background: #fed7d7;
		color: #c53030;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-weight: 600;
	}

	.session-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-left: 0.5rem;
	}

	.action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
		font-size: 0.875rem;
	}

	.action-btn:hover {
		background: #e2e8f0;
	}

	.details-panel {
		background: white;
		display: flex;
		flex-direction: column;
	}

	.session-details-view {
		padding: 1.5rem;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.session-header-info {
		margin-bottom: 1.5rem;
	}

	.session-header-info h3 {
		margin: 0 0 0.5rem 0;
		color: #2d3748;
		font-size: 1.25rem;
	}

	.session-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: #718096;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.max-mode {
		color: #d69e2e;
		font-weight: 600;
	}

	.conversation-view {
		flex: 1;
		margin-bottom: 1.5rem;
	}

	.conversation-view h4 {
		margin: 0 0 1rem 0;
		color: #4a5568;
		font-size: 1rem;
	}

	.messages-container {
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 1rem;
	}

	.message {
		margin-bottom: 1rem;
		padding: 0.75rem;
		border-radius: 6px;
	}

	.message-user {
		background: #ebf8ff;
		border-left: 3px solid #4299e1;
	}

	.message-assistant {
		background: #f0fff4;
		border-left: 3px solid #48bb78;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
	}

	.message-role {
		font-weight: 600;
		text-transform: capitalize;
		color: #4a5568;
	}

	.message-time {
		color: #718096;
	}

	.message-content {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #2d3748;
	}

	.message-truncated {
		color: #718096;
		font-style: italic;
	}

	.no-messages, .no-session {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #718096;
	}

	.no-messages-content, .no-session-content {
		text-align: center;
	}

	.no-messages-icon, .no-session-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.no-messages-content h4, .no-session-content h3 {
		margin: 0 0 0.5rem 0;
		color: #4a5568;
	}

	.no-messages-content p, .no-session-content p {
		margin: 0;
		font-size: 0.875rem;
	}

	.message-input-section {
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.message-input-section h4 {
		margin: 0 0 1rem 0;
		color: #4a5568;
		font-size: 1rem;
	}

	.message-input {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.message-field {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.message-field:focus {
		outline: none;
		border-color: #805ad5;
	}

	.input-note {
		margin: 0;
		font-size: 0.75rem;
		color: #718096;
		font-style: italic;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.agent-content {
			grid-template-columns: 1fr;
		}

		.sessions-panel {
			border-right: none;
			border-bottom: 1px solid #e2e8f0;
		}

		.agent-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.agent-actions {
			justify-content: center;
		}

		.session-details {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.session-stats {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
