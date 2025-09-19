<!--
	Pocket Server Dashboard
	Modern SvelteKit UI using Svelte 5 runes for interacting with API and WebSockets
-->
<script>
	import SystemHealth from '$lib/components/SystemHealth.svelte';
	import WebSocketMonitor from '$lib/components/WebSocketMonitor.svelte';
	import AuthPanel from '$lib/components/AuthPanel.svelte';
	import ApiExplorer from '$lib/components/ApiExplorer.svelte';
	import FileSystemBrowser from '$lib/components/FileSystemBrowser.svelte';
	import TerminalManager from '$lib/components/TerminalManager.svelte';
	import AgentManager from '$lib/components/AgentManager.svelte';

	let activeTab = $state('overview');

	const tabs = [
		{ id: 'overview', label: '📊 Overview', icon: '📊' },
		{ id: 'filesystem', label: '📁 File System', icon: '📁' },
		{ id: 'terminal', label: '🖥️ Terminal', icon: '🖥️' },
		{ id: 'agent', label: '🤖 Agent', icon: '🤖' },
		{ id: 'websocket', label: '🔌 WebSocket', icon: '🔌' },
		{ id: 'auth', label: '🔐 Authentication', icon: '🔐' },
		{ id: 'api', label: '🔍 API Explorer', icon: '🔍' }
	];

	function selectTab(tabId) {
		activeTab = tabId;
	}
</script>

<svelte:head>
	<title>Pocket Server Dashboard</title>
	<meta name="description" content="Interactive dashboard for Pocket Server API and WebSocket management" />
</svelte:head>

<div class="dashboard">
	<header class="header">
		<div class="header-content">
			<div class="brand">
				<h1>🚀 Pocket Server</h1>
				<p>Interactive Dashboard</p>
			</div>
			<div class="server-info">
				<span class="version">SvelteKit Edition</span>
				<span class="status-indicator">🟢 Running</span>
			</div>
		</div>
	</header>

	<nav class="navigation">
		<div class="nav-content">
			{#each tabs as tab}
				<button 
					class="nav-tab"
					class:active={activeTab === tab.id}
					onclick={() => selectTab(tab.id)}
				>
					<span class="tab-icon">{tab.icon}</span>
					<span class="tab-label">{tab.label.replace(/^\S+\s/, '')}</span>
				</button>
			{/each}
		</div>
	</nav>

	<main class="main-content">
		{#if activeTab === 'overview'}
			<div class="overview-grid">
				<div class="overview-section">
					<SystemHealth />
				</div>
				<div class="overview-section">
					<AuthPanel />
				</div>
			</div>
		{:else if activeTab === 'filesystem'}
			<div class="single-panel">
				<FileSystemBrowser />
			</div>
		{:else if activeTab === 'terminal'}
			<div class="single-panel">
				<TerminalManager />
			</div>
		{:else if activeTab === 'agent'}
			<div class="single-panel">
				<AgentManager />
			</div>
		{:else if activeTab === 'websocket'}
			<div class="single-panel">
				<WebSocketMonitor />
			</div>
		{:else if activeTab === 'auth'}
			<div class="single-panel">
				<AuthPanel />
			</div>
		{:else if activeTab === 'api'}
			<div class="single-panel">
				<ApiExplorer />
			</div>
		{/if}
	</main>

	<footer class="footer">
		<div class="footer-content">
			<div class="footer-info">
				<span>Powered by SvelteKit 2.0 with Svelte 5 Runes</span>
				<span>•</span>
				<span>Built for Pocket Agent</span>
			</div>
			<div class="footer-links">
				<a href="/api/health" target="_blank">Health Check</a>
				<span>•</span>
				<a href="https://github.com/itlackey/pocket-server" target="_blank">GitHub</a>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f8f9fa;
		color: #333;
		line-height: 1.6;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.dashboard {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 1rem 0;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.brand h1 {
		margin: 0;
		font-size: 1.8rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.brand p {
		margin: 0;
		opacity: 0.9;
		font-size: 0.9rem;
	}

	.server-info {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.version {
		font-size: 0.8rem;
		opacity: 0.8;
		background: rgba(255,255,255,0.2);
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
	}

	.status-indicator {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.navigation {
		background: white;
		border-bottom: 1px solid #e0e0e0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		padding: 0 1rem;
	}

	.nav-tab {
		padding: 1rem 1.5rem;
		border: none;
		background: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #666;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		position: relative;
	}

	.nav-tab:hover {
		background: #f8f9fa;
		color: #333;
	}

	.nav-tab.active {
		color: #667eea;
		border-bottom-color: #667eea;
		background: #f8f9fa;
	}

	.tab-icon {
		font-size: 1.1rem;
	}

	.tab-label {
		font-weight: 500;
	}

	.main-content {
		flex: 1;
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
		width: 100%;
	}

	.overview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		align-items: start;
	}

	.overview-section {
		display: flex;
		flex-direction: column;
	}

	.single-panel {
		max-width: 100%;
	}

	.footer {
		background: #333;
		color: #ccc;
		padding: 1rem 0;
		margin-top: auto;
	}

	.footer-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
	}

	.footer-info, .footer-links {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.footer-links a {
		color: #ccc;
		text-decoration: none;
		transition: color 0.2s;
	}

	.footer-links a:hover {
		color: white;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.header-content {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}

		.server-info {
			align-items: center;
		}

		.nav-content {
			overflow-x: auto;
			scrollbar-width: none;
			-ms-overflow-style: none;
		}

		.nav-content::-webkit-scrollbar {
			display: none;
		}

		.nav-tab {
			white-space: nowrap;
			padding: 1rem;
		}

		.overview-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.main-content {
			padding: 1rem;
		}

		.footer-content {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}
	}

	@media (max-width: 480px) {
		.brand h1 {
			font-size: 1.5rem;
		}

		.nav-tab .tab-label {
			display: none;
		}

		.nav-tab {
			padding: 1rem 0.75rem;
		}
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		:global(body) {
			background: #1a1a1a;
			color: #e0e0e0;
		}

		.navigation {
			background: #2d2d2d;
			border-bottom-color: #404040;
		}

		.nav-tab {
			color: #b0b0b0;
		}

		.nav-tab:hover {
			background: #3d3d3d;
			color: #e0e0e0;
		}

		.nav-tab.active {
			background: #3d3d3d;
		}
	}

	/* Animation for tab transitions */
	.main-content {
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>