import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	// Test configuration
	testDir: './tests',
	testMatch: '**/*.spec.js', // Only run .spec.js files (E2E tests), not .test.js (unit tests)
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	timeout: 30000, // 30 second timeout for E2E tests

	// Reporting
	reporter: [
		['html'],
		['list'], // Console output
		...(process.env.CI ? [['github']] : [])
	],

	// Global test settings
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		// Reasonable timeouts for WebSocket operations
		actionTimeout: 10000,
		navigationTimeout: 15000,
	},

	// Browser projects - optimized for development and CI
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		// Only run other browsers in CI or when explicitly requested
		...(process.env.CI || process.env.ALL_BROWSERS ? [
			{
				name: 'firefox',
				use: { ...devices['Desktop Firefox'] },
			},
			{
				name: 'webkit',
				use: { ...devices['Desktop Safari'] },
			},
			{
				name: 'Mobile Chrome',
				use: { ...devices['Pixel 5'] },
			},
		] : []),
	],

	// Development server
	webServer: {
		command: 'node src/server.js',
		port: 3000,
		reuseExistingServer: !process.env.CI, // In CI, always start fresh server
		timeout: 120 * 1000, // 2 minute startup timeout
	},
});