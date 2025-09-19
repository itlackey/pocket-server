<!--
	File System Browser Component
	Browse, search, and manage files using the converted file system service
-->
<script>
	import { apiClient } from '$lib/stores/api.svelte.js';
	import { onMount } from 'svelte';

	let currentPath = $state('');
	let directoryListing = $state(null);
	let searchQuery = $state('');
	let searchResults = $state([]);
	let selectedFile = $state(null);
	let fileContent = $state(null);
	let showSearch = $state(false);

	// Reactive computed for breadcrumbs
	const breadcrumbs = $derived(() => {
		if (!currentPath) return [];
		return currentPath.split('/').filter(Boolean).map((part, index, parts) => ({
			name: part,
			path: '/' + parts.slice(0, index + 1).join('/')
		}));
	});

	async function loadDirectory(path = '') {
		try {
			const result = await apiClient.request(`/fs/list${path ? `?path=${encodeURIComponent(path)}` : ''}`);
			directoryListing = result;
			currentPath = result.path;
		} catch (error) {
			console.error('Failed to load directory:', error);
		}
	}

	async function search() {
		if (!searchQuery.trim()) return;
		
		try {
			const result = await apiClient.request(`/fs/search?query=${encodeURIComponent(searchQuery)}&limit=20`);
			searchResults = result;
		} catch (error) {
			console.error('Search failed:', error);
		}
	}

	async function openFile(filePath) {
		try {
			const result = await apiClient.request(`/fs/read?path=${encodeURIComponent(filePath)}`);
			selectedFile = filePath;
			fileContent = result;
		} catch (error) {
			console.error('Failed to read file:', error);
		}
	}

	function navigateToPath(path) {
		loadDirectory(path);
		showSearch = false;
		selectedFile = null;
		fileContent = null;
	}

	function formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
	}

	function formatDate(date) {
		return new Date(date).toLocaleString();
	}

	function getFileIcon(node) {
		if (node.type === 'directory') return '📁';
		if (node.extension === '.js') return '📄';
		if (node.extension === '.ts') return '📘';
		if (node.extension === '.json') return '⚙️';
		if (node.extension === '.md') return '📝';
		if (node.extension === '.html') return '🌐';
		if (node.extension === '.css') return '🎨';
		return '📄';
	}

	onMount(() => {
		loadDirectory();
	});
</script>

<div class="file-browser">
	<div class="header">
		<h3>📁 File System Browser</h3>
		<div class="controls">
			<button onclick={() => showSearch = !showSearch} class="search-toggle">
				{showSearch ? '📁' : '🔍'} {showSearch ? 'Browse' : 'Search'}
			</button>
			<button onclick={() => loadDirectory(currentPath)} disabled={apiClient.loading.value}>
				{apiClient.loading.value ? '🔄' : '↻'} Refresh
			</button>
		</div>
	</div>

	{#if apiClient.error.value}
		<div class="error">
			❌ Error: {apiClient.error.value}
			<button onclick={() => apiClient.clearError()} class="clear-error">×</button>
		</div>
	{/if}

	{#if showSearch}
		<div class="search-section">
			<div class="search-controls">
				<input 
					bind:value={searchQuery}
					placeholder="Search files and directories..."
					class="search-input"
					onkeydown={(e) => e.key === 'Enter' && search()}
				/>
				<button onclick={search} disabled={!searchQuery.trim() || apiClient.loading.value}>
					🔍 Search
				</button>
			</div>

			{#if searchResults.length > 0}
				<div class="search-results">
					<h4>Search Results ({searchResults.length})</h4>
					<div class="file-list">
						{#each searchResults as result}
							<div class="file-item" onclick={() => result.type === 'file' ? openFile(result.path) : navigateToPath(result.path)}>
								<span class="file-icon">{result.type === 'directory' ? '📁' : '📄'}</span>
								<div class="file-info">
									<span class="file-name">{result.name}</span>
									<span class="file-path">{result.path}</span>
								</div>
								<span class="file-score">Score: {result.score}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="browser-section">
			{#if directoryListing}
				<div class="navigation">
					<div class="breadcrumbs">
						<button onclick={() => navigateToPath('')} class="breadcrumb home">🏠</button>
						{#each breadcrumbs as crumb}
							<span class="separator">/</span>
							<button onclick={() => navigateToPath(crumb.path)} class="breadcrumb">
								{crumb.name}
							</button>
						{/each}
					</div>
					
					{#if directoryListing.parent}
						<button onclick={() => navigateToPath(directoryListing.parent)} class="parent-btn">
							⬆️ Parent
						</button>
					{/if}
				</div>

				<div class="file-list">
					{#each directoryListing.nodes as node}
						<div class="file-item" onclick={() => node.type === 'file' ? openFile(node.path) : navigateToPath(node.path)}>
							<span class="file-icon">{getFileIcon(node)}</span>
							<div class="file-info">
								<span class="file-name">{node.name}</span>
								<div class="file-meta">
									<span class="file-size">{formatFileSize(node.size)}</span>
									<span class="file-date">{formatDate(node.modified)}</span>
									{#if node.projectType && node.projectType !== 'unknown'}
										<span class="project-type">{node.projectType}</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if fileContent}
		<div class="file-viewer">
			<div class="viewer-header">
				<h4>📄 {selectedFile?.split('/').pop()}</h4>
				<button onclick={() => { selectedFile = null; fileContent = null; }} class="close-viewer">×</button>
			</div>
			<div class="file-metadata">
				<span>Size: {formatFileSize(fileContent.size)}</span>
				<span>Language: {fileContent.language || 'text'}</span>
				<span>Encoding: {fileContent.encoding}</span>
			</div>
			<pre class="file-content">{fileContent.content}</pre>
		</div>
	{/if}
</div>

<style>
	.file-browser {
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

	.controls {
		display: flex;
		gap: 0.5rem;
	}

	.search-toggle, .clear-error {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.search-toggle:hover {
		background: #f5f5f5;
		border-color: #999;
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

	.search-section, .browser-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.search-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.search-controls button {
		padding: 0.5rem 1rem;
		background: #2196F3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.search-controls button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.navigation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.5rem;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		flex: 1;
	}

	.breadcrumb {
		background: none;
		border: none;
		color: #2196F3;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		transition: background 0.2s;
	}

	.breadcrumb:hover {
		background: rgba(33, 150, 243, 0.1);
	}

	.breadcrumb.home {
		font-size: 1rem;
	}

	.separator {
		margin: 0 0.25rem;
		color: #666;
	}

	.parent-btn {
		padding: 0.25rem 0.5rem;
		background: #4CAF50;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.file-list {
		flex: 1;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		background: #fafafa;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		cursor: pointer;
		transition: background 0.2s;
	}

	.file-item:hover {
		background: #f0f0f0;
	}

	.file-item:last-child {
		border-bottom: none;
	}

	.file-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.file-info {
		flex: 1;
		min-width: 0;
	}

	.file-name {
		display: block;
		font-weight: 500;
		color: #333;
		word-break: break-word;
	}

	.file-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: #666;
	}

	.file-path {
		font-size: 0.8rem;
		color: #666;
		font-family: 'Courier New', monospace;
	}

	.file-score {
		font-size: 0.8rem;
		color: #999;
	}

	.project-type {
		background: #e3f2fd;
		color: #1976d2;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.7rem;
	}

	.file-viewer {
		margin-top: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
		max-height: 300px;
		display: flex;
		flex-direction: column;
	}

	.viewer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		background: #f5f5f5;
		border-bottom: 1px solid #e0e0e0;
	}

	.viewer-header h4 {
		margin: 0;
		font-size: 0.9rem;
		color: #333;
	}

	.close-viewer {
		background: #ff4444;
		color: white;
		border: none;
		border-radius: 3px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.file-metadata {
		padding: 0.5rem 1rem;
		background: #f9f9f9;
		border-bottom: 1px solid #e0e0e0;
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: #666;
	}

	.file-content {
		flex: 1;
		margin: 0;
		padding: 1rem;
		font-size: 0.8rem;
		line-height: 1.4;
		overflow: auto;
		background: white;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.search-results h4 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1rem;
	}
</style>