<!--
	Authentication Panel Component
	Manages device registration and pairing functionality
-->
<script>
	import { apiClient } from '$lib/stores/api.svelte.js';
	import { onMount } from 'svelte';

	let deviceId = $state('');
	let deviceStatus = $state(null);
	let pairingStatus = $state(null);
	let checkInterval = $state(null);
	let autoCheck = $state(false);

	// Generate a random device ID for testing
	function generateDeviceId() {
		deviceId = 'device-' + crypto.randomUUID().slice(0, 8);
	}

	async function checkDeviceStatus() {
		if (!deviceId.trim()) return;
		
		try {
			deviceStatus = await apiClient.getDeviceStatus(deviceId.trim());
		} catch (error) {
			console.error('Failed to check device status:', error);
			deviceStatus = null;
		}
	}

	async function checkPairingStatus() {
		try {
			pairingStatus = await apiClient.getPairingStatus();
		} catch (error) {
			console.error('Failed to check pairing status:', error);
			pairingStatus = null;
		}
	}

	async function refreshAll() {
		await Promise.all([
			checkDeviceStatus(),
			checkPairingStatus()
		]);
	}

	function toggleAutoCheck() {
		autoCheck = !autoCheck;
		if (autoCheck) {
			startAutoCheck();
		} else {
			stopAutoCheck();
		}
	}

	function startAutoCheck() {
		if (checkInterval) clearInterval(checkInterval);
		checkInterval = setInterval(refreshAll, 3000);
	}

	function stopAutoCheck() {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}
	}

	// Reactive computed for pairing countdown
	const pairingCountdown = $derived(() => {
		if (!pairingStatus?.active || !pairingStatus?.secondsLeft) return null;
		return pairingStatus.secondsLeft;
	});

	// Reactive computed for device status display
	const deviceStatusDisplay = $derived(() => {
		if (!deviceStatus) return { text: 'Unknown', color: '#666', icon: '❓' };
		if (deviceStatus.registered) {
			return { text: 'Registered', color: '#4CAF50', icon: '✅' };
		} else {
			return { text: 'Not Registered', color: '#f44336', icon: '❌' };
		}
	});

	// Reactive computed for pairing status display
	const pairingStatusDisplay = $derived(() => {
		if (!pairingStatus) return { text: 'Unknown', color: '#666', icon: '❓' };
		if (pairingStatus.active) {
			return { text: 'Active', color: '#4CAF50', icon: '🔓' };
		} else {
			return { text: 'Inactive', color: '#f44336', icon: '🔒' };
		}
	});

	onMount(() => {
		generateDeviceId();
		refreshAll();
		
		return () => {
			stopAutoCheck();
		};
	});
</script>

<div class="auth-panel">
	<div class="header">
		<h3>🔐 Authentication</h3>
		<div class="controls">
			<button onclick={refreshAll} disabled={apiClient.loading.value} class="refresh-btn">
				{apiClient.loading.value ? '🔄' : '↻'} Refresh
			</button>
			<button onclick={toggleAutoCheck} class="auto-check-btn" class:active={autoCheck}>
				{autoCheck ? '⏸️' : '▶️'} Auto
			</button>
		</div>
	</div>

	{#if apiClient.error.value}
		<div class="error">
			❌ Error: {apiClient.error.value}
			<button onclick={() => apiClient.clearError()} class="clear-error">×</button>
		</div>
	{/if}

	<div class="auth-sections">
		<!-- Device Status Section -->
		<div class="section">
			<h4>Device Registration</h4>
			
			<div class="device-input-group">
				<div class="input-row">
					<input 
						bind:value={deviceId}
						placeholder="Enter device ID"
						class="device-id-input"
					/>
					<button onclick={generateDeviceId} class="generate-btn" title="Generate random device ID">
						🎲
					</button>
				</div>
				<button 
					onclick={checkDeviceStatus} 
					disabled={!deviceId.trim() || apiClient.loading.value}
					class="check-btn"
				>
					Check Status
				</button>
			</div>

			{#if deviceStatus !== null}
				<div class="status-display">
					<div class="status-item">
						<label>Status:</label>
						<span 
							class="status-value" 
							style="color: {deviceStatusDisplay().color}"
						>
							{deviceStatusDisplay().icon} {deviceStatusDisplay().text}
						</span>
					</div>
					<div class="status-item">
						<label>Device ID:</label>
						<span class="device-id">{deviceId}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Pairing Status Section -->
		<div class="section">
			<h4>Pairing Window</h4>
			
			{#if pairingStatus !== null}
				<div class="status-display">
					<div class="status-item">
						<label>Status:</label>
						<span 
							class="status-value" 
							style="color: {pairingStatusDisplay().color}"
						>
							{pairingStatusDisplay().icon} {pairingStatusDisplay().text}
						</span>
					</div>

					{#if pairingStatus.active}
						<div class="status-item">
							<label>Expires At:</label>
							<span class="expires-at">
								{new Date(pairingStatus.expiresAt).toLocaleTimeString()}
							</span>
						</div>

						{#if pairingCountdown()}
							<div class="status-item">
								<label>Time Left:</label>
								<span class="countdown" class:urgent={pairingCountdown() < 30}>
									{pairingCountdown()}s
								</span>
							</div>
							<div class="countdown-bar">
								<div 
									class="countdown-fill" 
									style="width: {Math.max(0, Math.min(100, (pairingCountdown() / 60) * 100))}%"
								></div>
							</div>
						{/if}
					{:else}
						<div class="inactive-message">
							<p>Pairing window is currently closed.</p>
							<p>Use the CLI to start a pairing session:</p>
							<code>pocket-server pair</code>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Instructions Section -->
		<div class="section instructions">
			<h4>📋 Instructions</h4>
			<div class="instruction-steps">
				<div class="step">
					<span class="step-number">1</span>
					<div class="step-content">
						<strong>Start Pairing:</strong>
						<code>pocket-server pair</code>
					</div>
				</div>
				<div class="step">
					<span class="step-number">2</span>
					<div class="step-content">
						<strong>Enter PIN in mobile app</strong> when prompted
					</div>
				</div>
				<div class="step">
					<span class="step-number">3</span>
					<div class="step-content">
						<strong>Check device status</strong> above after pairing
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.auth-panel {
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

	.refresh-btn, .auto-check-btn, .generate-btn, .check-btn, .clear-error {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.refresh-btn:hover, .auto-check-btn:hover, .generate-btn:hover {
		background: #f5f5f5;
		border-color: #999;
	}

	.refresh-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.auto-check-btn.active {
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

	.auth-sections {
		display: grid;
		gap: 1.5rem;
	}

	.section {
		border: 1px solid #f0f0f0;
		border-radius: 6px;
		padding: 1rem;
		background: #fafafa;
	}

	.section h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1rem;
	}

	.device-input-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.device-id-input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
	}

	.generate-btn {
		padding: 0.5rem;
		width: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.check-btn {
		padding: 0.5rem 1rem;
		background: #2196F3;
		color: white;
		border: 1px solid #2196F3;
		cursor: pointer;
	}

	.check-btn:disabled {
		background: #ccc;
		border-color: #ccc;
		cursor: not-allowed;
	}

	.status-display {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.status-item label {
		font-weight: 600;
		color: #666;
		font-size: 0.9rem;
	}

	.status-value {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.device-id {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: #333;
		background: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
	}

	.expires-at {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: #666;
	}

	.countdown {
		font-family: 'Courier New', monospace;
		font-weight: bold;
		font-size: 1rem;
		color: #4CAF50;
	}

	.countdown.urgent {
		color: #f44336;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.countdown-bar {
		width: 100%;
		height: 6px;
		background: #e0e0e0;
		border-radius: 3px;
		overflow: hidden;
		margin-top: 0.5rem;
	}

	.countdown-fill {
		height: 100%;
		background: linear-gradient(90deg, #f44336 0%, #FFC107 50%, #4CAF50 100%);
		transition: width 1s ease;
	}

	.inactive-message {
		color: #666;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.inactive-message code {
		background: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		color: #333;
	}

	.instructions {
		background: #f0f7ff;
		border-color: #e3f2fd;
	}

	.instruction-steps {
		display: grid;
		gap: 1rem;
	}

	.step {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: #2196F3;
		color: white;
		border-radius: 50%;
		font-size: 0.8rem;
		font-weight: bold;
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.step-content code {
		background: #e3f2fd;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		color: #1976d2;
		display: block;
		margin-top: 0.25rem;
	}
</style>