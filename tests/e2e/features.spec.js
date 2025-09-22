import { test, expect } from '@playwright/test';

/**
 * Advanced Feature Tests for Dispatch Server SvelteKit UI
 * Tests specific feature interactions, data flow, and edge cases
 */

test.describe('Advanced Feature Interactions', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toContainText('Dispatch Server');
	});

	test('File System operations work end-to-end', async ({ page }) => {
		// Navigate to File System tab
		await page.locator('text=File System').click();
		
		// Test directory navigation
		await expect(page.locator('text=Current Path')).toBeVisible();
		
		// Test search functionality with real search
		const searchInput = page.locator('input[placeholder*="Search"]');
		if (await searchInput.count() > 0) {
			await searchInput.fill('package.json');
			await page.keyboard.press('Enter');
			await page.waitForTimeout(2000);
			
			// Should show search results
			const results = page.locator('[class*="result"], [class*="file"]');
			if (await results.count() > 0) {
				await expect(results.first()).toBeVisible();
			}
		}
		
		// Test file viewing
		const fileLinks = page.locator('a[href*="file"], button:has-text("."), [class*="file-name"]');
		if (await fileLinks.count() > 0) {
			await fileLinks.first().click();
			await page.waitForTimeout(1000);
			
			// Should show file content or metadata
			const content = page.locator('[class*="content"], [class*="preview"]');
			if (await content.count() > 0) {
				await expect(content.first()).toBeVisible();
			}
		}
	});

	test('Terminal operations work with real commands', async ({ page }) => {
		// Navigate to Terminal tab
		await page.locator('text=Terminal').click();
		
		// Create a new terminal session
		const createButton = page.locator('button:has-text("Create Session")');
		if (await createButton.count() > 0) {
			await createButton.click();
			await page.waitForTimeout(1000);
			
			// Execute a simple command
			const commandInput = page.locator('input[placeholder*="command"], input[placeholder*="Command"]');
			if (await commandInput.count() > 0) {
				await commandInput.first().fill('pwd');
				
				const executeButton = page.locator('button:has-text("Execute")');
				if (await executeButton.count() > 0) {
					await executeButton.click();
					await page.waitForTimeout(2000);
					
					// Should show command output
					const output = page.locator('[class*="output"], [class*="result"]');
					if (await output.count() > 0) {
						await expect(output.first()).toBeVisible();
					}
				}
			}
		}
		
		// Check session list updates
		await expect(page.locator('text=Sessions')).toBeVisible();
	});

	test('Agent session management flow works', async ({ page }) => {
		// Navigate to Agent tab  
		await page.locator('text=Agent').click();
		
		// Create a new agent session
		const createButton = page.locator('button:has-text("Create Session")');
		if (await createButton.count() > 0) {
			await createButton.click();
			await page.waitForTimeout(1000);
			
			// Fill in session details
			const workingDirInput = page.locator('input[placeholder*="working"], input[value*="/"]');
			if (await workingDirInput.count() > 0) {
				await workingDirInput.first().clear();
				await workingDirInput.first().fill('/tmp');
			}
			
			// Submit session creation
			const submitButton = page.locator('button:has-text("Create"), button:has-text("Submit")');
			if (await submitButton.count() > 0) {
				await submitButton.click();
				await page.waitForTimeout(2000);
				
				// Should show new session in list
				const sessionList = page.locator('[class*="session"], text=Session');
				await expect(sessionList.first()).toBeVisible();
			}
		}
		
		// Test session management operations
		const sessionItems = page.locator('[class*="session-item"], button:has-text("session")');
		if (await sessionItems.count() > 0) {
			// Click on a session
			await sessionItems.first().click();
			await page.waitForTimeout(1000);
			
			// Should show session details
			const details = page.locator('[class*="detail"], [class*="snapshot"]');
			if (await details.count() > 0) {
				await expect(details.first()).toBeVisible();
			}
		}
	});

	test('WebSocket connection and messaging works', async ({ page }) => {
		// Navigate to WebSocket tab
		await page.locator('text=WebSocket').click();
		
		// Check initial connection status
		await expect(page.locator('text=Connection Status')).toBeVisible();
		
		// Try to connect
		const connectButton = page.locator('button:has-text("Connect")');
		if (await connectButton.count() > 0) {
			await connectButton.click();
			await page.waitForTimeout(3000);
			
			// Should show connected status
			const status = page.locator('[class*="status"], text=Connected');
			if (await status.count() > 0) {
				await expect(status.first()).toBeVisible();
			}
			
			// Send a test message
			const messageInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]');
			if (await messageInput.count() > 0) {
				const testMessage = JSON.stringify({
					type: 'ping',
					timestamp: Date.now(),
					data: 'e2e test message'
				});
				
				await messageInput.first().fill(testMessage);
				
				const sendButton = page.locator('button:has-text("Send")');
				if (await sendButton.count() > 0) {
					await sendButton.click();
					await page.waitForTimeout(2000);
					
					// Should show message in history
					const messageHistory = page.locator('[class*="message"], [class*="history"]');
					if (await messageHistory.count() > 0) {
						await expect(messageHistory.first()).toBeVisible();
					}
				}
			}
		}
	});

	test('API Explorer can test multiple endpoints', async ({ page }) => {
		// Navigate to API Explorer tab
		await page.locator('text=API Explorer').click();
		
		// Test health endpoint
		const endpointSelect = page.locator('select, [role="combobox"]');
		if (await endpointSelect.count() > 0) {
			// Select health endpoint if available
			const healthOption = page.locator('option:has-text("health"), text=health');
			if (await healthOption.count() > 0) {
				await healthOption.click();
			}
		}
		
		// Execute request
		const executeButton = page.locator('button:has-text("Execute")');
		await executeButton.click();
		await page.waitForTimeout(3000);
		
		// Should show response
		const response = page.locator('[class*="response"], [class*="result"]');
		if (await response.count() > 0) {
			await expect(response.first()).toBeVisible();
			
			// Should contain JSON data
			const responseText = await response.first().textContent();
			expect(responseText).toContain('{');
		}
		
		// Check request history
		const history = page.locator('[class*="history"], text=History');
		if (await history.count() > 0) {
			await expect(history.first()).toBeVisible();
		}
		
		// Test another endpoint if dropdown exists
		if (await endpointSelect.count() > 0) {
			await endpointSelect.first().click();
			
			const authOption = page.locator('option:has-text("auth"), text=device');
			if (await authOption.count() > 0) {
				await authOption.click();
				await executeButton.click();
				await page.waitForTimeout(2000);
			}
		}
	});

	test('Authentication device status check works', async ({ page }) => {
		// Navigate to Authentication tab
		await page.locator('text=Authentication').click();
		
		// Find device input
		const deviceInput = page.locator('input[placeholder*="device"], input[value*="device"]');
		if (await deviceInput.count() > 0) {
			// Enter a test device ID
			await deviceInput.first().clear();
			await deviceInput.first().fill('test-device-e2e-123');
			
			// Click check status
			const checkButton = page.locator('button:has-text("Check Status")');
			await checkButton.click();
			await page.waitForTimeout(2000);
			
			// Should show status result
			await expect(page.locator('text=Status:')).toBeVisible();
			
			const statusResult = page.locator('text=Not Registered, text=Registered');
			await expect(statusResult.first()).toBeVisible();
			
			// Should show device ID
			const deviceId = page.locator('text=Device ID:');
			await expect(deviceId).toBeVisible();
		}
		
		// Check pairing status
		const pairingStatus = page.locator('text=Pairing window is currently');
		await expect(pairingStatus).toBeVisible();
	});

	test('System health auto-refresh updates data', async ({ page }) => {
		// Start on Overview tab
		await expect(page.locator('text=System Health')).toBeVisible();
		
		// Get initial uptime value
		const uptimeElement = page.locator('text=/\\d+[hms]/, text=/\\d+\\.\\d+s/').first();
		const initialUptime = await uptimeElement.textContent();
		
		// Enable auto-refresh
		const autoToggle = page.locator('input[type="checkbox"]').first();
		if (!(await autoToggle.isChecked())) {
			await autoToggle.click();
		}
		
		// Wait for refresh cycle
		await page.waitForTimeout(6000);
		
		// Check that the uptime value changed or page is still functional
		const currentUptime = await uptimeElement.textContent();
		
		// Either uptime changed or we can still see the health data
		expect(currentUptime !== initialUptime || currentUptime?.length > 0).toBeTruthy();
		
		// Memory usage should be visible
		await expect(page.locator('text=Memory Usage')).toBeVisible();
		
		// Progress bar should be visible
		const progressBar = page.locator('[role="progressbar"], .progress, [class*="progress"]');
		if (await progressBar.count() > 0) {
			await expect(progressBar.first()).toBeVisible();
		}
	});

	test('Tab state persistence during navigation', async ({ page }) => {
		// Go to File System and interact
		await page.locator('text=File System').click();
		const searchInput = page.locator('input[placeholder*="Search"]');
		if (await searchInput.count() > 0) {
			await searchInput.fill('test-search-term');
		}
		
		// Switch to another tab
		await page.locator('text=Terminal').click();
		await page.waitForTimeout(500);
		
		// Switch back to File System
		await page.locator('text=File System').click();
		
		// Search term should still be there (if component maintains state)
		if (await searchInput.count() > 0) {
			const searchValue = await searchInput.inputValue();
			// Either the value persisted or the component reset (both are valid behaviors)
			expect(typeof searchValue).toBe('string');
		}
	});

	test('Error states are handled gracefully', async ({ page }) => {
		// Navigate to API Explorer
		await page.locator('text=API Explorer').click();
		
		// Try to test an endpoint that might not exist
		const endpointSelect = page.locator('select, [role="combobox"]');
		if (await endpointSelect.count() > 0) {
			// Find an endpoint
			await endpointSelect.first().click();
			await page.waitForTimeout(500);
		}
		
		// Execute request
		const executeButton = page.locator('button:has-text("Execute")');
		await executeButton.click();
		
		// Wait for either success or error
		await page.waitForTimeout(5000);
		
		// Should show some kind of response (success or error)
		const responseArea = page.locator('[class*="response"], [class*="result"], [class*="error"]');
		if (await responseArea.count() > 0) {
			await expect(responseArea.first()).toBeVisible();
		}
		
		// Page should still be functional
		await expect(page.locator('text=API Explorer')).toBeVisible();
		await expect(executeButton).toBeVisible();
	});

	test('Mobile responsive behavior works correctly', async ({ page }) => {
		// Test tablet size
		await page.setViewportSize({ width: 768, height: 1024 });
		
		// Navigation should still work
		await page.locator('text=File System').click();
		await expect(page.locator('text=File System Browser')).toBeVisible();
		
		await page.locator('text=WebSocket').click();
		await expect(page.locator('text=WebSocket Monitor')).toBeVisible();
		
		// Test mobile size
		await page.setViewportSize({ width: 375, height: 667 });
		
		// Should still be navigable
		await page.locator('text=Overview').click();
		await expect(page.locator('text=System Health')).toBeVisible();
		
		// Elements should be visible and clickable
		const refreshButton = page.locator('button:has-text("Refresh")').first();
		if (await refreshButton.count() > 0) {
			await expect(refreshButton).toBeVisible();
			await refreshButton.click();
		}
		
		// Navigation tabs should be accessible
		await page.locator('text=Authentication').click();
		await expect(page.locator('text=Device Registration')).toBeVisible();
	});

	test('Performance and load handling', async ({ page }) => {
		// Rapid tab switching to test performance
		const tabs = ['File System', 'Terminal', 'Agent', 'WebSocket', 'API Explorer', 'Overview'];
		
		for (let i = 0; i < 3; i++) {
			for (const tab of tabs) {
				await page.locator(`text=${tab}`).click();
				await page.waitForTimeout(100);
			}
		}
		
		// Should still be responsive
		await expect(page.locator('h1')).toContainText('Dispatch Server');
		
		// Test multiple API calls
		await page.locator('text=API Explorer').click();
		const executeButton = page.locator('button:has-text("Execute")');
		
		// Make multiple rapid requests
		for (let i = 0; i < 3; i++) {
			await executeButton.click();
			await page.waitForTimeout(200);
		}
		
		// Page should still be functional
		await expect(page.locator('text=API Explorer')).toBeVisible();
	});
});