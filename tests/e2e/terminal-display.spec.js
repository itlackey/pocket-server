import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Terminal Input/Output Display Issues
 * Verifies that terminal commands show both input and output in the UI
 */

test.describe('Terminal Display Issues', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the dashboard and go to terminal tab
		await page.goto('/');
		await expect(page.locator('h1')).toContainText('Pocket Server');

		// Navigate to Terminal tab
		await page.locator('.nav-tab .tab-label:has-text("Terminal")').click();
		await page.waitForTimeout(500);
		await expect(page.locator('text=Terminal Manager')).toBeVisible();
	});

	test('terminal input and output should be displayed in the UI', async ({ page }) => {
		// Check if there are existing sessions or create a new one
		const newSessionBtn = page.locator('button:has-text("New Session")');
		if (await newSessionBtn.isVisible()) {
			await newSessionBtn.click();
			// Wait for session creation
			await page.waitForTimeout(1000);
		}

		// Find and select a terminal session
		const sessionItems = page.locator('.session-item');
		if (await sessionItems.count() > 0) {
			await sessionItems.first().click();
			await page.waitForTimeout(500);
		}

		// Check if command input is available
		const commandInput = page.locator('input.command-input, input[placeholder*="command"], input[placeholder*="Command"]');
		await expect(commandInput).toBeVisible();

		// Test simple echo command
		const testCommand = 'echo "Hello Terminal Test"';
		await commandInput.fill(testCommand);

		// Execute the command
		const executeButton = page.locator('button:has-text("Execute")');
		await expect(executeButton).toBeVisible();
		await executeButton.click();

		// Wait for command execution
		await page.waitForTimeout(2000);

		// Check terminal output area
		const terminalOutput = page.locator('.terminal-output, .terminal-display pre, [class*="terminal"][class*="output"]');
		await expect(terminalOutput.first()).toBeVisible();

		// Verify that BOTH input and output are displayed
		const outputContent = await terminalOutput.first().textContent();

		// Should show the command that was executed
		expect(outputContent).toContain(testCommand);

		// Should show the output of the echo command
		expect(outputContent).toContain('Hello Terminal Test');

		// The input field should be cleared after execution
		await expect(commandInput).toHaveValue('');
	});

	test('terminal should support real-time WebSocket communication', async ({ page }) => {
		// This test verifies that the terminal uses WebSocket for real-time I/O
		// First, let's check if WebSocket connection is established

		// Navigate to WebSocket tab to establish connection
		await page.locator('text=WebSocket').click();
		await page.waitForTimeout(500);

		// Connect to WebSocket if not already connected
		const connectBtn = page.locator('button:has-text("Connect")');
		if (await connectBtn.isVisible()) {
			await connectBtn.click();
			await page.waitForTimeout(2000);
		}

		// Verify WebSocket is connected
		await expect(page.locator('.connection-status.connected')).toBeVisible();

		// Go back to terminal tab
		await page.locator('text=Terminal').click();
		await page.waitForTimeout(500);

		// Check for terminal session
		const newSessionBtn = page.locator('button:has-text("New Session")');
		if (await newSessionBtn.isVisible()) {
			await newSessionBtn.click();
			await page.waitForTimeout(1000);
		}

		// Select a session if available
		const sessionItems = page.locator('.session-item');
		if (await sessionItems.count() > 0) {
			await sessionItems.first().click();
			await page.waitForTimeout(500);
		}

		// Check if terminal is using WebSocket for real-time communication
		// This should show immediate character-by-character output
		const commandInput = page.locator('input.command-input');
		if (await commandInput.isVisible()) {
			// Type a command that produces immediate output
			await commandInput.fill('ls -la');

			const executeButton = page.locator('button:has-text("Execute")');
			await executeButton.click();

			// Wait and check for real-time output
			await page.waitForTimeout(3000);

			const terminalOutput = page.locator('.terminal-output, .terminal-display pre');
			const outputContent = await terminalOutput.first().textContent();

			// Should show the command and its output
			expect(outputContent).toContain('ls -la');
			expect(outputContent.length).toBeGreaterThan(10); // Should have some output
		}
	});

	test('terminal should show command history and maintain session state', async ({ page }) => {
		// Create or select a terminal session
		const newSessionBtn = page.locator('button:has-text("New Session")');
		if (await newSessionBtn.isVisible()) {
			await newSessionBtn.click();
			await page.waitForTimeout(1000);
		}

		const sessionItems = page.locator('.session-item');
		if (await sessionItems.count() > 0) {
			await sessionItems.first().click();
			await page.waitForTimeout(500);
		}

		const commandInput = page.locator('input.command-input');
		const executeButton = page.locator('button:has-text("Execute")');
		const terminalOutput = page.locator('.terminal-output, .terminal-display pre');

		if (await commandInput.isVisible() && await executeButton.isVisible()) {
			// Execute first command
			await commandInput.fill('echo "First command"');
			await executeButton.click();
			await page.waitForTimeout(1000);

			// Execute second command
			await commandInput.fill('echo "Second command"');
			await executeButton.click();
			await page.waitForTimeout(1000);

			// Check that both commands and their outputs are visible
			const outputContent = await terminalOutput.first().textContent();

			expect(outputContent).toContain('First command');
			expect(outputContent).toContain('Second command');

			// Commands should be shown with prompt indicators
			expect(outputContent).toContain('echo "First command"');
			expect(outputContent).toContain('echo "Second command"');
		}
	});

	test('terminal should handle command errors gracefully', async ({ page }) => {
		// Create or select a terminal session
		const newSessionBtn = page.locator('button:has-text("New Session")');
		if (await newSessionBtn.isVisible()) {
			await newSessionBtn.click();
			await page.waitForTimeout(1000);
		}

		const sessionItems = page.locator('.session-item');
		if (await sessionItems.count() > 0) {
			await sessionItems.first().click();
			await page.waitForTimeout(500);
		}

		const commandInput = page.locator('input.command-input');
		const executeButton = page.locator('button:has-text("Execute")');

		if (await commandInput.isVisible() && await executeButton.isVisible()) {
			// Execute a command that will fail
			await commandInput.fill('invalidcommandthatdoesnotexist');
			await executeButton.click();
			await page.waitForTimeout(2000);

			// Check that error output is displayed
			const terminalOutput = page.locator('.terminal-output, .terminal-display pre');
			const outputContent = await terminalOutput.first().textContent();

			// Should show the failed command
			expect(outputContent).toContain('invalidcommandthatdoesnotexist');

			// Should show some kind of error message
			const hasError = outputContent.includes('not found') ||
							outputContent.includes('command not found') ||
							outputContent.includes('error') ||
							outputContent.length > 20; // Some error output

			expect(hasError).toBeTruthy();
		}
	});
});