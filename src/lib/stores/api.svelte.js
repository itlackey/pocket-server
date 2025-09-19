/**
 * API client using Svelte 5 runes for reactive state management
 */

let loading = $state(false);
let error = $state(null);

/**
 * API client class with reactive state
 */
export class ApiClient {
	constructor() {
		this.loading = {
			get value() { return loading; }
		};
		
		this.error = {
			get value() { return error; }
		};
	}

	/**
	 * Make an API request
	 * @param {string} endpoint - API endpoint
	 * @param {object} options - Fetch options
	 */
	async request(endpoint, options = {}) {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api${endpoint}`, {
				headers: {
					'Content-Type': 'application/json',
					...options.headers
				},
				...options
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			return data;
		} catch (err) {
			error = err.message;
			throw err;
		} finally {
			loading = false;
		}
	}

	/**
	 * Get system health
	 */
	async getHealth() {
		return this.request('/health');
	}

	/**
	 * Check device registration status
	 * @param {string} deviceId - Device ID to check
	 */
	async getDeviceStatus(deviceId) {
		return this.request(`/auth/device/status?deviceId=${encodeURIComponent(deviceId)}`);
	}

	/**
	 * Get pairing status
	 */
	async getPairingStatus() {
		return this.request('/auth/pair/status');
	}

	/**
	 * Get file system listing
	 * @param {string} path - Path to list
	 */
	async getFileList(path = '') {
		const query = path ? `?path=${encodeURIComponent(path)}` : '';
		return this.request(`/fs/list${query}`);
	}

	/**
	 * Create agent session
	 * @param {object} options - Session options
	 */
	async createAgentSession(options = {}) {
		return this.request('/agent/session', {
			method: 'POST',
			body: JSON.stringify(options)
		});
	}

	/**
	 * Clear error state
	 */
	clearError() {
		error = null;
	}
}

// Export singleton instance
export const apiClient = new ApiClient();