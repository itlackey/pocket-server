<!--
	System Health Component
	Displays server health information and provides refresh functionality
-->
<script>
	import { apiClient } from '$lib/stores/api.svelte.js';
	import { onMount } from 'svelte';

	let healthData = $state(null);
	let refreshInterval = $state(null);
	let autoRefresh = $state(true);

	// Reactive computed for uptime formatting
	const formattedUptime = $derived(() => {
		if (!healthData?.uptime) return 'N/A';
		const seconds = Math.floor(healthData.uptime);
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;
		return `${hours}h ${minutes}m ${remainingSeconds}s`;
	});

	// Reactive computed for memory formatting
	const formattedMemory = $derived(() => {
		if (!healthData?.memory) return { used: 'N/A', total: 'N/A', percentage: 0 };
		const used = (healthData.memory.used / 1024 / 1024).toFixed(1);
		const total = (healthData.memory.total / 1024 / 1024).toFixed(1);
		const percentage = ((healthData.memory.used / healthData.memory.total) * 100).toFixed(1);
		return { used: `${used} MB`, total: `${total} MB`, percentage: parseFloat(percentage) };
	});

	async function fetchHealth() {
		try {
			healthData = await apiClient.getHealth();
		} catch (error) {
			console.error('Failed to fetch health:', error);
		}
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}

	function startAutoRefresh() {
		if (refreshInterval) clearInterval(refreshInterval);
		refreshInterval = setInterval(fetchHealth, 5000);
	}

	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	onMount(() => {
		fetchHealth();
		if (autoRefresh) {
			startAutoRefresh();
		}

		return () => {
			stopAutoRefresh();
		};
	});
</script>

<div class="health-panel">
	<div class="header">
		<h3>🏥 System Health</h3>
		<div class="controls">
			<button onclick={fetchHealth} disabled={apiClient.loading.value} class="refresh-btn">
				{apiClient.loading.value ? '🔄' : '↻'} Refresh
			</button>
			<button onclick={toggleAutoRefresh} class="auto-refresh-btn" class:active={autoRefresh}>
				{autoRefresh ? '⏸️' : '▶️'} Auto
			</button>
		</div>
	</div>

	{#if apiClient.error.value}
		<div class="error">
			❌ Error: {apiClient.error.value}
			<button onclick={() => apiClient.clearError()} class="clear-error">×</button>
		</div>
	{/if}

	{#if healthData}
		<div class="metrics">
			<div class="metric">
				<label>Status</label>
				<span class="value status-{healthData.status}">{healthData.status.toUpperCase()}</span>
			</div>

			<div class="metric">
				<label>Uptime</label>
				<span class="value">{formattedUptime()}</span>
			</div>

			<div class="metric">
				<label>Memory Usage</label>
				<div class="memory-info">
					<span class="value">{formattedMemory().used} / {formattedMemory().total}</span>
					<div class="memory-bar">
						<div class="memory-fill" style="width: {formattedMemory().percentage}%"></div>
					</div>
					<span class="percentage">{formattedMemory().percentage}%</span>
				</div>
			</div>

			<div class="metric">
				<label>Last Updated</label>
				<span class="value timestamp">{new Date(healthData.timestamp).toLocaleTimeString()}</span>
			</div>
		</div>
	{:else if !apiClient.loading.value}
		<div class="no-data">No health data available</div>
	{/if}

	{#if apiClient.loading.value}
		<div class="loading">Loading...</div>
	{/if}
</div>

<style>
	.health-panel {
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

	.controls {
		display: flex;
		gap: 0.5rem;
	}

	.refresh-btn, .auto-refresh-btn, .clear-error {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.refresh-btn:hover, .auto-refresh-btn:hover {
		background: #f5f5f5;
		border-color: #999;
	}

	.refresh-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.auto-refresh-btn.active {
		background: #4CAF50;
		color: white;
		border-color: #4CAF50;
	}

	.clear-error {
		background: #ff4444;
		color: white;
		border: none;
		margin-left: 0.5rem;
	}

	.error {
		background: #ffebee;
		color: #c62828;
		padding: 0.5rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.metrics {
		display: grid;
		gap: 1rem;
	}

	.metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.metric label {
		font-weight: 600;
		color: #666;
		font-size: 0.9rem;
	}

	.metric .value {
		font-family: 'Courier New', monospace;
		font-size: 0.95rem;
	}

	.status-ok {
		color: #4CAF50;
		font-weight: bold;
	}

	.status-error {
		color: #f44336;
		font-weight: bold;
	}

	.memory-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.memory-bar {
		width: 100%;
		height: 8px;
		background: #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
	}

	.memory-fill {
		height: 100%;
		background: linear-gradient(90deg, #4CAF50 0%, #FFC107 70%, #f44336 90%);
		transition: width 0.3s ease;
	}

	.percentage {
		font-size: 0.8rem;
		color: #666;
		align-self: flex-end;
	}

	.timestamp {
		color: #666;
		font-size: 0.9rem;
	}

	.loading, .no-data {
		text-align: center;
		color: #666;
		padding: 2rem;
		font-style: italic;
	}
</style>