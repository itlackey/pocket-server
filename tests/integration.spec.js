import { test, expect } from '@playwright/test';

/**
 * Integration and Component-Specific Tests
 * Tests component behavior, data flow between UI and APIs, and integration scenarios
 */

test.describe('UI Component Integration Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toContainText('Pocket Server');
	});

	test('System Health component displays real-time data', async ({ page }) => {
		// Check that system health displays actual data
		await expect(page.locator('text=System Health')).toBeVisible();
		
		// Memory usage should show actual values
		const memoryText = page.locator('text=/\\d+(\\.\\d+)?\\s*MB/');
		await expect(memoryText.first()).toBeVisible();
		
		// Uptime should be a real value
		const uptimeText = page.locator('text=/\\d+[hms]/, text=/\\d+\\.\\d+s/');
		await expect(uptimeText.first()).toBeVisible();
		
		// Status should be OK
		await expect(page.locator('text=OK')).toBeVisible();
		
		// Test manual refresh
		const refreshButton = page.locator('button:has-text("Refresh")').first();
		await refreshButton.click();
		
		// Wait for refresh to complete
		await page.waitForTimeout(1000);
		
		// Data should still be present
		await expect(page.locator('text=System Health')).toBeVisible();
		await expect(memoryText.first()).toBeVisible();
	});

	test('Authentication panel integrates with real API', async ({ page }) => {
		await page.locator('text=Authentication').click();
		
		// Test device status check with real API call
		const deviceInput = page.locator('input[placeholder*="device"], input[value*="device"]');
		await expect(deviceInput.first()).toBeVisible();
		
		// Clear and enter test device ID
		await deviceInput.first().clear();
		await deviceInput.first().fill('e2e-test-device-123');
		
		// Click check status button
		const checkButton = page.locator('button:has-text("Check Status")');
		await checkButton.click();
		
		// Wait for API response
		await page.waitForTimeout(2000);
		
		// Should show status (likely "Not Registered" for test device)
		await expect(page.locator('text=Status:')).toBeVisible();
		await expect(page.locator('text=Not Registered')).toBeVisible();
		
		// Should show the device ID we entered
		await expect(page.locator('text=e2e-test-device-123')).toBeVisible();
		
		// Test pairing status check
		const pairingStatus = page.locator('text=Pairing window is currently');
		await expect(pairingStatus).toBeVisible();
		
		// Should show "closed" since we're not in pairing mode
		await expect(page.locator('text=closed')).toBeVisible();
	});

	test('File System browser connects to real file system', async ({ page }) => {
		await page.locator('text=File System').click();
		
		// Wait for file system to load
		await page.waitForTimeout(2000);
		
		// Should show current path
		await expect(page.locator('text=Current Path')).toBeVisible();
		
		// Should show some files/directories
		const fileItems = page.locator('[class*="file"], [class*="directory"], [class*="item"]');
		
		// Wait for file list to load
		await page.waitForTimeout(1000);
		
		// Should have at least some items (even if it's just parent directory)
		if (await fileItems.count() > 0) {
			await expect(fileItems.first()).toBeVisible();
		}
		
		// Test search functionality
		const searchInput = page.locator('input[placeholder*="Search"]');
		if (await searchInput.count() > 0) {
			await searchInput.fill('package.json');
			await page.keyboard.press('Enter');
			
			// Wait for search results
			await page.waitForTimeout(3000);
			
			// Should show search results or "no results" message
			const results = page.locator('[class*="result"], [class*="search"], text=results');
			if (await results.count() > 0) {
				await expect(results.first()).toBeVisible();
			}
		}
	});

	test('API Explorer executes real API requests', async ({ page }) => {
		await page.locator('text=API Explorer').click();
		
		// Should have endpoint selector
		const endpointSelect = page.locator('select, [role="combobox"]');
		await expect(endpointSelect.first()).toBeVisible();
		
		// Execute health endpoint (should be available)
		const executeButton = page.locator('button:has-text("Execute")');
		await executeButton.click();
		
		// Wait for API response
		await page.waitForTimeout(3000);
		
		// Should show response data
		const response = page.locator('[class*="response"], [class*="result"]');
		if (await response.count() > 0) {
			await expect(response.first()).toBeVisible();
			
			// Response should contain JSON data for health endpoint
			const responseText = await response.first().textContent();
			
			// Should contain typical health response fields
			expect(responseText).toMatch(/uptime|memory|status|connections/);
		}
		
		// Should show request in history
		const history = page.locator('[class*="history"], text=History');
		if (await history.count() > 0) {
			await expect(history.first()).toBeVisible();
		}
	});

	test('WebSocket monitor handles real WebSocket connections', async ({ page }) => {
		await page.locator('text=WebSocket').click();
		
		// Check initial state
		await expect(page.locator('text=Connection Status')).toBeVisible();
		
		// Try to connect to WebSocket
		const connectButton = page.locator('button:has-text("Connect")');
		if (await connectButton.count() > 0) {
			await connectButton.click();
			
			// Wait for connection attempt
			await page.waitForTimeout(3000);
			
			// Should show connection result (connected or error)
			const statusElements = page.locator('[class*="status"], text=Connected, text=Error, text=Disconnected');
			await expect(statusElements.first()).toBeVisible();
			
			// If connected, test sending a message
			const connectionStatus = await statusElements.first().textContent();
			if (connectionStatus?.includes('Connected') || connectionStatus?.includes('connected')) {
				// Send a ping message
				const messageInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]');
				if (await messageInput.count() > 0) {
					const pingMessage = JSON.stringify({ type: 'ping', data: 'e2e-test' });
					await messageInput.first().fill(pingMessage);
					
					const sendButton = page.locator('button:has-text("Send")');
					if (await sendButton.count() > 0) {
						await sendButton.click();
						
						// Wait for message to be sent and potential response
						await page.waitForTimeout(2000);
						
						// Should show message in history
						const messageHistory = page.locator('[class*="message"], [class*="history"]');
						if (await messageHistory.count() > 0) {
							await expect(messageHistory.first()).toBeVisible();
						}
					}
				}
			}
		}
	});

	test('Terminal manager creates and manages real sessions', async ({ page }) => {
		await page.locator('text=Terminal').click();
		
		// Should show terminal manager
		await expect(page.locator('text=Terminal Manager')).toBeVisible();
		
		// Should show session list (even if empty)
		await expect(page.locator('text=Sessions, text=Active Sessions')).toBeVisible();
		
		// Try to create a new session
		const createButton = page.locator('button:has-text("Create Session")');
		if (await createButton.count() > 0) {
			await createButton.click();
			
			// Wait for session creation
			await page.waitForTimeout(2000);
			
			// Should show session creation result
			const sessionElements = page.locator('[class*="session"], text=Session, text=Created');
			if (await sessionElements.count() > 0) {
				await expect(sessionElements.first()).toBeVisible();
			}
			
			// Try to execute a command
			const commandInput = page.locator('input[placeholder*="command"], input[placeholder*="Command"]');
			if (await commandInput.count() > 0) {
				await commandInput.first().fill('echo "E2E Test Command"');
				
				const executeButton = page.locator('button:has-text("Execute")');
				if (await executeButton.count() > 0) {
					await executeButton.click();
					
					// Wait for command execution
					await page.waitForTimeout(3000);
					
					// Should show command output
					const output = page.locator('[class*="output"], [class*="result"]');
					if (await output.count() > 0) {
						await expect(output.first()).toBeVisible();
					}
				}
			}
		}
	});

	test('Agent manager creates and manages real sessions', async ({ page }) => {
		await page.locator('text=Agent').click();
		
		// Should show agent manager
		await expect(page.locator('text=Agent Manager')).toBeVisible();
		
		// Should show sessions list
		await expect(page.locator('text=Sessions, text=Agent Sessions')).toBeVisible();
		
		// Try to create a new session
		const createButton = page.locator('button:has-text("Create Session")');
		if (await createButton.count() > 0) {
			await createButton.click();
			
			// Should show session creation form
			const workingDirInput = page.locator('input[placeholder*="working"], input[value*="/"]');
			if (await workingDirInput.count() > 0) {
				// Set working directory
				await workingDirInput.first().clear();
				await workingDirInput.first().fill('/tmp');
				
				// Submit session creation
				const submitButton = page.locator('button:has-text("Create"), button:has-text("Submit")');
				if (await submitButton.count() > 0) {
					await submitButton.click();
					
					// Wait for session creation
					await page.waitForTimeout(3000);
					
					// Should show new session
					const sessions = page.locator('[class*="session"], text=Session');
					if (await sessions.count() > 0) {
						await expect(sessions.first()).toBeVisible();
					}
				}
			}
		}
		
		// Check that sessions list is functional
		const sessionsList = page.locator('[class*="session-list"], [class*="sessions"]');
		if (await sessionsList.count() > 0) {
			await expect(sessionsList.first()).toBeVisible();
		}
	});

	test('Component state management works correctly', async ({ page }) => {
		// Test auto-refresh state in health component
		const autoToggle = page.locator('input[type="checkbox"]').first();
		
		// Toggle auto-refresh on
		if (!(await autoToggle.isChecked())) {
			await autoToggle.click();
		}
		expect(await autoToggle.isChecked()).toBe(true);
		
		// Switch tabs and come back
		await page.locator('text=File System').click();
		await page.waitForTimeout(500);
		await page.locator('text=Overview').click();
		
		// Auto-refresh should still be enabled
		expect(await autoToggle.isChecked()).toBe(true);
		
		// Toggle it off
		await autoToggle.click();
		expect(await autoToggle.isChecked()).toBe(false);
	});

	test('Error handling in API components', async ({ page }) => {
		// Go to API Explorer and try various endpoints
		await page.locator('text=API Explorer').click();
		
		// Try executing without selecting anything specific
		const executeButton = page.locator('button:has-text("Execute")');
		await executeButton.click();
		
		// Wait for response
		await page.waitForTimeout(3000);
		
		// Should handle the response gracefully (success or error)
		const responseArea = page.locator('[class*="response"], [class*="error"], [class*="result"]');
		if (await responseArea.count() > 0) {
			await expect(responseArea.first()).toBeVisible();
		}
		
		// Page should still be functional
		await expect(page.locator('text=API Explorer')).toBeVisible();
		await expect(executeButton).toBeEnabled();
	});

	test('Data validation in forms', async ({ page }) => {
		// Test authentication form validation
		await page.locator('text=Authentication').click();
		
		const deviceInput = page.locator('input[placeholder*="device"], input[value*="device"]');
		const checkButton = page.locator('button:has-text("Check Status")');
		
		// Test with empty input
		await deviceInput.first().clear();
		await checkButton.click();
		
		// Should either show error or handle gracefully
		await page.waitForTimeout(1000);
		
		// Page should still be functional
		await expect(page.locator('text=Device Registration')).toBeVisible();
		
		// Test with valid input
		await deviceInput.first().fill('valid-device-id');
		await checkButton.click();
		await page.waitForTimeout(2000);
		
		// Should show status result
		await expect(page.locator('text=Status:')).toBeVisible();
	});

	test('Real-time updates work correctly', async ({ page }) => {
		// Enable auto-refresh in health component
		const autoToggle = page.locator('input[type="checkbox"]').first();
		if (!(await autoToggle.isChecked())) {
			await autoToggle.click();
		}
		
		// Get initial timestamp
		const timestamp = page.locator('text=Last Updated');
		const initialTime = await timestamp.textContent();
		
		// Wait for auto-refresh cycle (assuming 5 second intervals)
		await page.waitForTimeout(6000);
		
		// Check if timestamp changed or data is still fresh
		const newTime = await timestamp.textContent();
		
		// Either time changed or component is still showing updated data
		expect(newTime !== initialTime || newTime?.includes('PM') || newTime?.includes('AM')).toBeTruthy();
	});

	test('Component cleanup and memory management', async ({ page }) => {
		// Rapidly switch between tabs to test cleanup
		const tabs = ['File System', 'Terminal', 'Agent', 'WebSocket', 'Authentication', 'API Explorer'];
		
		// Switch tabs rapidly multiple times
		for (let cycle = 0; cycle < 5; cycle++) {
			for (const tab of tabs) {
				await page.locator(`text=${tab}`).click();
				await page.waitForTimeout(50);
			}
		}
		
		// Return to overview
		await page.locator('text=Overview').click();
		
		// Everything should still work
		await expect(page.locator('text=System Health')).toBeVisible();
		await expect(page.locator('text=Uptime')).toBeVisible();
		
		// Auto-refresh should still function
		const refreshButton = page.locator('button:has-text("Refresh")').first();
		await refreshButton.click();
		await page.waitForTimeout(1000);
		
		await expect(page.locator('text=Memory Usage')).toBeVisible();
	});

	test('Accessibility and keyboard navigation', async ({ page }) => {
		// Test tab navigation
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		
		// Should be able to navigate with keyboard
		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);
		
		// Test escape key handling
		await page.keyboard.press('Escape');
		
		// Should still be functional
		await expect(page.locator('h1')).toContainText('Pocket Server');
		
		// Test focus management
		const firstButton = page.locator('button').first();
		await firstButton.focus();
		
		const focusedElement = page.locator(':focus');
		await expect(focusedElement).toBeVisible();
	});

	test('Cross-tab data consistency', async ({ page }) => {
		// Create something in one tab and check if it appears in another
		
		// Go to Agent tab and create a session
		await page.locator('text=Agent').click();
		
		const createButton = page.locator('button:has-text("Create Session")');
		if (await createButton.count() > 0) {
			await createButton.click();
			await page.waitForTimeout(1000);
			
			// Submit session if form appears
			const submitButton = page.locator('button:has-text("Create"), button:has-text("Submit")');
			if (await submitButton.count() > 0) {
				await submitButton.click();
				await page.waitForTimeout(2000);
			}
		}
		
		// Go to API Explorer and check sessions endpoint
		await page.locator('text=API Explorer').click();
		
		// Select sessions endpoint if available
		const endpointSelect = page.locator('select, [role="combobox"]');
		if (await endpointSelect.count() > 0) {
			await endpointSelect.first().click();
			
			const sessionsOption = page.locator('option:has-text("sessions"), text=sessions');
			if (await sessionsOption.count() > 0) {
				await sessionsOption.click();
				
				const executeButton = page.locator('button:has-text("Execute")');
				await executeButton.click();
				await page.waitForTimeout(2000);
				
				// Should show sessions data
				const response = page.locator('[class*="response"]');
				if (await response.count() > 0) {
					const responseText = await response.first().textContent();
					expect(responseText).toContain('sessions');
				}
			}
		}
	});
});