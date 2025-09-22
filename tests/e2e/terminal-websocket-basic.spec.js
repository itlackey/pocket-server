import { test, expect } from '@playwright/test';

/**
 * Basic WebSocket Terminal Functionality Test
 * Tests the core terminal WebSocket functionality in isolation
 */

test.describe('Terminal WebSocket Basic Functionality', () => {
	test('terminal WebSocket connection and command execution works', async ({ page }) => {
		// Navigate to the test page
		await page.goto('/terminal-test');
		await expect(page.locator('h1')).toContainText('WebSocket Terminal Test');

		// Connect to WebSocket
		const connectBtn = page.locator('button:has-text("Connect WebSocket")');
		await expect(connectBtn).toBeVisible();
		await connectBtn.click();

		// Wait for connection and verify status
		await page.waitForTimeout(2000);
		await expect(page.locator('text=Connected')).toBeVisible();

		// Create terminal session
		const createSessionBtn = page.locator('button:has-text("Create Terminal Session")');
		await expect(createSessionBtn).toBeVisible();
		await expect(createSessionBtn).toBeEnabled();
		await createSessionBtn.click();

		// Wait for session creation
		await page.waitForTimeout(2000);
		await expect(page.locator('text=Session created:')).toBeVisible();

		// Test command execution
		const commandInput = page.locator('input[placeholder="Enter command"]');
		const sendCommandBtn = page.locator('button:has-text("Send Command")');

		await expect(commandInput).toBeVisible();
		await expect(sendCommandBtn).toBeEnabled();

		// Send a simple echo command
		await commandInput.fill('echo "Hello Terminal"');
		await sendCommandBtn.click();

		// Wait for command execution and check output
		await page.waitForTimeout(3000);

		const outputArea = page.locator('div:has-text("$ echo")');
		await expect(outputArea).toBeVisible();

		// Check that we can see the command in the output
		const outputText = await outputArea.textContent();
		expect(outputText).toContain('$ echo "Hello Terminal"');
		expect(outputText).toContain('Hello Terminal');

		// Test another command
		await commandInput.fill('pwd');
		await sendCommandBtn.click();
		await page.waitForTimeout(2000);

		// Should show current directory
		const finalOutput = await outputArea.textContent();
		expect(finalOutput).toContain('$ pwd');
		expect(finalOutput).toContain('/'); // Should show some path
	});

	test('WebSocket messages are logged correctly', async ({ page }) => {
		// Navigate to the test page
		await page.goto('/terminal-test');

		// Connect to WebSocket
		await page.locator('button:has-text("Connect WebSocket")').click();
		await page.waitForTimeout(2000);

		// Check messages log
		const messagesArea = page.locator('h2:has-text("WebSocket Messages")').locator('..').locator('div').last();
		await expect(messagesArea).toBeVisible();

		// Should have connection messages
		await expect(messagesArea).toContainText('Connecting to WebSocket');
		await expect(messagesArea).toContainText('WebSocket connected');
	});

	test('error handling works correctly', async ({ page }) => {
		// Navigate to the test page
		await page.goto('/terminal-test');

		// Try to create session without connection
		const createSessionBtn = page.locator('button:has-text("Create Terminal Session")');
		await expect(createSessionBtn).toBeDisabled();

		// Try to send command without session
		const sendCommandBtn = page.locator('button:has-text("Send Command")');
		await expect(sendCommandBtn).toBeDisabled();
	});
});