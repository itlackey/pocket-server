<!--
	API Explorer Component
	Interactive tool for testing various API endpoints
-->
<script>
	import { apiClient } from '$lib/stores/api.svelte.js';

	let selectedEndpoint = $state('/health');
	let customPath = $state('');
	let requestMethod = $state('GET');
	let requestBody = $state('{}');
	let currentPath = $state('');
	let sessionOptions = $state('{"workingDir": "/tmp", "maxMode": false}');
	let lastResponse = $state(null);
	let requestHistory = $state([]);

	const endpoints = [
		{ path: '/health', method: 'GET', description: 'System health check' },
		{ path: '/auth/device/status', method: 'GET', description: 'Check device registration', params: '?deviceId=test' },
		{ path: '/auth/pair/status', method: 'GET', description: 'Get pairing status' },
		{ path: '/fs/list', method: 'GET', description: 'List directory contents', params: '?path=' },
		{ path: '/fs/read', method: 'GET', description: 'Read file contents', params: '?path=' },
		{ path: '/fs/write', method: 'POST', description: 'Write file contents' },
		{ path: '/fs/search', method: 'GET', description: 'Search files and directories', params: '?query=' },
		{ path: '/fs/delete', method: 'DELETE', description: 'Delete file or directory', params: '?path=' },
		{ path: '/fs/metadata', method: 'GET', description: 'Get file metadata', params: '?path=' },
		{ path: '/agent/session', method: 'POST', description: 'Create agent session' },
		{ path: '/agent/sessions', method: 'GET', description: 'List agent sessions' },
		{ path: '/agent/snapshot', method: 'GET', description: 'Get session snapshot', params: '?sessionId=' },
		{ path: '/agent/title', method: 'PUT', description: 'Update session title' },
		{ path: '/agent/clear', method: 'DELETE', description: 'Clear session conversation', params: '?sessionId=' },
		{ path: 'custom', method: 'GET', description: 'Custom endpoint' }
	];

	// Reactive computed for current endpoint info
	const currentEndpoint = $derived(() => {
		return endpoints.find(e => e.path === selectedEndpoint) || endpoints[0];
	});

	// Reactive computed for final URL
	const finalUrl = $derived(() => {
		if (selectedEndpoint === 'custom') {
			return customPath.startsWith('/') ? customPath : `/${customPath}`;
		}
		
		let url = selectedEndpoint;
		
		// Add special parameters for specific endpoints
		if (selectedEndpoint === '/auth/device/status') {
			url += '?deviceId=test-device-123';
		} else if (selectedEndpoint === '/fs/list' && currentPath) {
			url += `?path=${encodeURIComponent(currentPath)}`;
		}
		
		return url;
	});

	async function executeRequest() {
		try {
			const endpoint = finalUrl();
			const method = currentEndpoint().method;
			
			let options = { method };
			
			if (method === 'POST' && requestBody.trim()) {
				options.body = requestBody;
			}

			const startTime = Date.now();
			const response = await apiClient.request(endpoint, options);
			const duration = Date.now() - startTime;

			lastResponse = {
				status: 'success',
				data: response,
				duration,
				timestamp: new Date().toISOString(),
				endpoint,
				method
			};

			// Add to history
			requestHistory = [lastResponse, ...requestHistory.slice(0, 9)]; // Keep last 10

		} catch (error) {
			lastResponse = {
				status: 'error',
				error: error.message,
				timestamp: new Date().toISOString(),
				endpoint: finalUrl(),
				method: currentEndpoint().method
			};

			// Add to history
			requestHistory = [lastResponse, ...requestHistory.slice(0, 9)];
		}
	}

	function selectEndpoint(endpoint) {
		selectedEndpoint = endpoint;
		
		// Set default request body for POST endpoints
		if (endpoint === '/agent/session') {
			requestBody = sessionOptions;
		} else {
			requestBody = '{}';
		}
	}

	function clearHistory() {
		requestHistory = [];
	}

	function formatResponseTime(duration) {
		return `${duration}ms`;
	}

	function getStatusColor(status) {
		return status === 'success' ? '#4CAF50' : '#f44336';
	}

	function formatTimestamp(ts) {
		return new Date(ts).toLocaleTimeString();
	}
</script>

<div class="api-explorer">
	<div class="header">
		<h3>🔍 API Explorer</h3>
		<div class="stats">
			{#if lastResponse}
				<span class="last-status" style="color: {getStatusColor(lastResponse.status)}">
					{lastResponse.status.toUpperCase()}
				</span>
			{/if}
		</div>
	</div>

	<div class="request-builder">
		<h4>Request Builder</h4>
		
		<div class="endpoint-selector">
			<label>Endpoint:</label>
			<select bind:value={selectedEndpoint} onchange={() => selectEndpoint(selectedEndpoint)}>
				{#each endpoints as endpoint}
					<option value={endpoint.path}>
						{endpoint.method} {endpoint.path} - {endpoint.description}
					</option>
				{/each}
			</select>
		</div>

		{#if selectedEndpoint === 'custom'}
			<div class="custom-path">
				<label>Custom Path:</label>
				<input 
					bind:value={customPath}
					placeholder="/api/custom/endpoint"
					class="path-input"
				/>
			</div>
		{/if}

		{#if selectedEndpoint === '/fs/list'}
			<div class="path-parameter">
				<label>Directory Path:</label>
				<input 
					bind:value={currentPath}
					placeholder="Leave empty for default or enter path like /home/user"
					class="path-input"
				/>
			</div>
		{/if}

		<div class="method-display">
			<label>Method:</label>
			<span class="method-badge method-{currentEndpoint().method.toLowerCase()}">
				{currentEndpoint().method}
			</span>
			<span class="final-url">
				/api{finalUrl()}
			</span>
		</div>

		{#if currentEndpoint().method === 'POST'}
			<div class="request-body">
				<label>Request Body (JSON):</label>
				<textarea 
					bind:value={requestBody}
					placeholder="Enter JSON request body"
					rows="4"
				></textarea>
				
				{#if selectedEndpoint === '/agent/session'}
					<div class="presets">
						<span class="preset-label">Presets:</span>
						<button onclick={() => requestBody = '{"workingDir": "/tmp", "maxMode": false}'}>
							Basic Session
						</button>
						<button onclick={() => requestBody = '{"workingDir": "/home/user/project", "maxMode": true}'}>
							Max Mode Session
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div class="execute-section">
			<button 
				onclick={executeRequest}
				disabled={apiClient.loading.value}
				class="execute-btn"
			>
				{apiClient.loading.value ? '⏳ Executing...' : '▶️ Execute Request'}
			</button>
			
			{#if apiClient.error.value}
				<div class="error-message">
					❌ {apiClient.error.value}
					<button onclick={() => apiClient.clearError()} class="clear-error">×</button>
				</div>
			{/if}
		</div>
	</div>

	{#if lastResponse}
		<div class="response-section">
			<h4>Last Response</h4>
			<div class="response-header">
				<div class="response-meta">
					<span class="status" style="color: {getStatusColor(lastResponse.status)}">
						{lastResponse.status.toUpperCase()}
					</span>
					<span class="endpoint-info">
						{lastResponse.method} {lastResponse.endpoint}
					</span>
					{#if lastResponse.duration}
						<span class="duration">{formatResponseTime(lastResponse.duration)}</span>
					{/if}
					<span class="timestamp">{formatTimestamp(lastResponse.timestamp)}</span>
				</div>
			</div>
			
			<div class="response-body">
				<pre>{JSON.stringify(lastResponse.data || lastResponse.error || lastResponse, null, 2)}</pre>
			</div>
		</div>
	{/if}

	{#if requestHistory.length > 0}
		<div class="history-section">
			<div class="history-header">
				<h4>Request History ({requestHistory.length})</h4>
				<button onclick={clearHistory} class="clear-history">Clear</button>
			</div>
			
			<div class="history-list">
				{#each requestHistory as request, i (i)}
					<div class="history-item" onclick={() => lastResponse = request}>
						<div class="history-meta">
							<span class="status" style="color: {getStatusColor(request.status)}">
								{request.status.toUpperCase()}
							</span>
							<span class="method-badge method-{request.method.toLowerCase()}">
								{request.method}
							</span>
							<span class="endpoint">{request.endpoint}</span>
							{#if request.duration}
								<span class="duration">{formatResponseTime(request.duration)}</span>
							{/if}
							<span class="timestamp">{formatTimestamp(request.timestamp)}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.api-explorer {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1rem;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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

	.last-status {
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		background: rgba(0,0,0,0.1);
	}

	.request-builder {
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1rem;
		background: #fafafa;
	}

	.request-builder h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1rem;
	}

	.endpoint-selector, .custom-path, .path-parameter, .method-display, .request-body {
		margin-bottom: 1rem;
	}

	.endpoint-selector label, .custom-path label, .path-parameter label, .method-display label, .request-body label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 600;
		color: #666;
		font-size: 0.9rem;
	}

	.endpoint-selector select, .path-input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.path-input {
		font-family: 'Courier New', monospace;
	}

	.method-display {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.method-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 600;
		font-family: 'Courier New', monospace;
	}

	.method-get {
		background: #e8f5e8;
		color: #2e7d32;
	}

	.method-post {
		background: #fff3e0;
		color: #ef6c00;
	}

	.method-put {
		background: #e3f2fd;
		color: #1976d2;
	}

	.method-delete {
		background: #ffebee;
		color: #c62828;
	}

	.final-url {
		font-family: 'Courier New', monospace;
		color: #666;
		font-size: 0.9rem;
		background: #f5f5f5;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		flex: 1;
	}

	.request-body textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		resize: vertical;
	}

	.presets {
		margin-top: 0.5rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.preset-label {
		font-size: 0.8rem;
		color: #666;
		font-weight: 500;
	}

	.presets button {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.presets button:hover {
		background: #f5f5f5;
		border-color: #999;
	}

	.execute-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.execute-btn {
		padding: 0.75rem 1.5rem;
		background: #4CAF50;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.2s;
		align-self: flex-start;
	}

	.execute-btn:hover:not(:disabled) {
		background: #45a049;
	}

	.execute-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.error-message {
		background: #ffebee;
		color: #c62828;
		padding: 0.5rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.9rem;
	}

	.clear-error {
		background: #f44336;
		color: white;
		border: none;
		border-radius: 3px;
		padding: 0.1rem 0.4rem;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.response-section, .history-section {
		margin-bottom: 1.5rem;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		overflow: hidden;
		background: white;
	}

	.response-section h4, .history-header h4 {
		margin: 0;
		padding: 0.75rem 1rem;
		background: #f5f5f5;
		border-bottom: 1px solid #e0e0e0;
		color: #333;
		font-size: 1rem;
	}

	.response-header {
		padding: 0.75rem 1rem;
		background: #f9f9f9;
		border-bottom: 1px solid #e0e0e0;
	}

	.response-meta, .history-meta {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		font-size: 0.8rem;
	}

	.status {
		font-weight: 600;
	}

	.endpoint-info, .endpoint {
		font-family: 'Courier New', monospace;
		color: #666;
	}

	.duration {
		color: #666;
		font-family: 'Courier New', monospace;
	}

	.timestamp {
		color: #999;
		margin-left: auto;
	}

	.response-body {
		padding: 1rem;
		background: #fafafa;
	}

	.response-body pre {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.4;
		color: #333;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #f5f5f5;
		border-bottom: 1px solid #e0e0e0;
	}

	.clear-history {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.clear-history:hover {
		background: #f5f5f5;
	}

	.history-list {
		max-height: 200px;
		overflow-y: auto;
	}

	.history-item {
		padding: 0.5rem 1rem;
		border-bottom: 1px solid #f0f0f0;
		cursor: pointer;
		transition: background 0.2s;
	}

	.history-item:hover {
		background: #f9f9f9;
	}

	.history-item:last-child {
		border-bottom: none;
	}
</style>