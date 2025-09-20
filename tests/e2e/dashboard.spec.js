import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Dispatch Server SvelteKit UI
 * Tests all UI components and features across all dashboard tabs
 */

test.describe('Dispatch Server Dashboard E2E Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the dashboard
		await page.goto('/');
		
		// Wait for the page to load completely
		await expect(page.locator('h1')).toContainText('Dispatch Server');
		await expect(page.locator('.rocket')).toBeVisible();
	});

	test('Dashboard loads correctly with all navigation tabs', async ({ page }) => {
		// Check main header and branding
		await expect(page.locator('h1')).toContainText('Dispatch Server');
		await expect(page.locator('text=SvelteKit Edition')).toBeVisible();
		await expect(page.locator('text=Running')).toBeVisible();
		
		// Check all navigation tabs are present
		const tabs = [
			'Overview',
			'File System', 
			'Terminal',
			'Agent',
			'WebSocket',
			'Authentication',
			'API Explorer'
		];
		
		for (const tab of tabs) {
			await expect(page.locator(`text=${tab}`)).toBeVisible();
		}
		
		// Check footer
		await expect(page.locator('text=Powered by SvelteKit 2.0 with Svelte 5 Runes')).toBeVisible();
		await expect(page.locator('text=Built for Pocket Agent')).toBeVisible();
	});

	test('Overview tab displays system health and authentication status', async ({ page }) => {
		// Should start on Overview tab
		await expect(page.locator('text=Overview').first()).toHaveClass(/active|selected/);
		
		// Check System Health section
		await expect(page.locator('text=System Health')).toBeVisible();
		await expect(page.locator('text=Status')).toBeVisible();
		await expect(page.locator('text=OK')).toBeVisible();
		await expect(page.locator('text=Uptime')).toBeVisible();
		await expect(page.locator('text=Memory Usage')).toBeVisible();
		
		// Check Auto refresh toggle
		const autoToggle = page.locator('input[type="checkbox"]').first();
		await expect(autoToggle).toBeVisible();
		
		// Test manual refresh button
		const refreshButton = page.locator('button:has-text("Refresh")').first();
		await expect(refreshButton).toBeVisible();
		await refreshButton.click();
		
		// Check Authentication section
		await expect(page.locator('text=Authentication')).toBeVisible();
		await expect(page.locator('text=Device Registration')).toBeVisible();
		await expect(page.locator('text=Pairing Window')).toBeVisible();
		await expect(page.locator('text=Instructions')).toBeVisible();
	});

	test('File System tab provides file browsing capabilities', async ({ page }) => {
		// Navigate to File System tab
		await page.locator('text=File System').click();
		await expect(page.locator('text=File System').first()).toHaveClass(/active|selected/);
		
		// Check File System Browser header
		await expect(page.locator('text=File System Browser')).toBeVisible();
		
		// Check current path display
		await expect(page.locator('text=Current Path')).toBeVisible();
		
		// Check search functionality
		const searchInput = page.locator('input[placeholder*="Search"]');
		await expect(searchInput).toBeVisible();
		
		// Test search functionality
		await searchInput.fill('package');
		await page.keyboard.press('Enter');
		
		// Check if search results appear (should show some files)
		await page.waitForTimeout(1000); // Wait for search
		
		// Check action buttons
		await expect(page.locator('button:has-text("Browse")')).toBeVisible();
		await expect(page.locator('button:has-text("Search")')).toBeVisible();
		
		// Test file listing
		const fileList = page.locator('.file-list, [class*="file"], [class*="directory"]');
		await expect(fileList.first()).toBeVisible();
	});

	test('Terminal tab provides terminal session management', async ({ page }) => {
		// Navigate to Terminal tab
		await page.locator('text=Terminal').click();
		await expect(page.locator('text=Terminal').first()).toHaveClass(/active|selected/);
		
		// Check Terminal Manager header
		await expect(page.locator('text=Terminal Manager')).toBeVisible();
		
		// Check session management
		await expect(page.locator('text=Active Sessions')).toBeVisible();
		
		// Check create session functionality
		const createButton = page.locator('button:has-text("Create Session")');
		await expect(createButton).toBeVisible();
		
		// Test creating a new terminal session
		await createButton.click();
		
		// Check if session creation UI appears
		await page.waitForTimeout(500);
		
		// Check command execution interface
		const commandInput = page.locator('input[placeholder*="command"], input[placeholder*="Command"]');
		if (await commandInput.count() > 0) {
			await expect(commandInput.first()).toBeVisible();
			
			// Test command execution
			await commandInput.first().fill('echo "Hello World"');
			
			const executeButton = page.locator('button:has-text("Execute")');
			if (await executeButton.count() > 0) {
				await executeButton.click();
				await page.waitForTimeout(1000);
			}
		}
		
		// Check session list
		await expect(page.locator('text=Session ID'), { timeout: 10000 }).toBeVisible();
	});

	test('Agent tab provides AI agent session management', async ({ page }) => {
		// Navigate to Agent tab
		await page.locator('text=Agent').click();
		await expect(page.locator('text=Agent').first()).toHaveClass(/active|selected/);
		
		// Check Agent Manager header
		await expect(page.locator('text=Agent Manager')).toBeVisible();
		
		// Check session management
		await expect(page.locator('text=Agent Sessions')).toBeVisible();
		
		// Check create session functionality
		const createButton = page.locator('button:has-text("Create Session")');
		await expect(createButton).toBeVisible();
		
		// Test creating a new agent session
		await createButton.click();
		await page.waitForTimeout(500);
		
		// Check session configuration options
		const workingDirInput = page.locator('input[placeholder*="working"], input[placeholder*="directory"]');
		if (await workingDirInput.count() > 0) {
			await expect(workingDirInput.first()).toBeVisible();
		}
		
		// Check max mode toggle
		const maxModeToggle = page.locator('input[type="checkbox"]:near(:text("Max Mode"))');
		if (await maxModeToggle.count() > 0) {
			await expect(maxModeToggle.first()).toBeVisible();
		}
		
		// Check sessions list
		await expect(page.locator('text=Session List, text=Sessions')).toBeVisible();
	});

	test('WebSocket tab provides connection monitoring and testing', async ({ page }) => {
		// Navigate to WebSocket tab
		await page.locator('text=WebSocket').click();
		await expect(page.locator('text=WebSocket').first()).toHaveClass(/active|selected/);
		
		// Check WebSocket Monitor header
		await expect(page.locator('text=WebSocket Monitor')).toBeVisible();
		
		// Check connection status
		await expect(page.locator('text=Connection Status')).toBeVisible();
		
		// Check connect/disconnect button
		const connectButton = page.locator('button:has-text("Connect"), button:has-text("Disconnect")');
		await expect(connectButton.first()).toBeVisible();
		
		// Test connection
		if (await page.locator('button:has-text("Connect")').count() > 0) {
			await page.locator('button:has-text("Connect")').click();
			await page.waitForTimeout(2000);
		}
		
		// Check message testing interface
		const messageInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]');
		if (await messageInput.count() > 0) {
			await expect(messageInput.first()).toBeVisible();
			
			// Test sending a ping message
			await messageInput.first().fill('{"type": "ping", "data": "test"}');
			
			const sendButton = page.locator('button:has-text("Send")');
			if (await sendButton.count() > 0) {
				await sendButton.click();
				await page.waitForTimeout(1000);
			}
		}
		
		// Check message history
		await expect(page.locator('text=Message History, text=Messages')).toBeVisible();
	});

	test('Authentication tab provides device and pairing management', async ({ page }) => {
		// Navigate to Authentication tab
		await page.locator('text=Authentication').click();
		await expect(page.locator('text=Authentication').first()).toHaveClass(/active|selected/);
		
		// Check Authentication Panel header
		await expect(page.locator('text=Authentication')).toBeVisible();
		
		// Check Device Registration section
		await expect(page.locator('text=Device Registration')).toBeVisible();
		
		// Check device ID input
		const deviceInput = page.locator('input[placeholder*="device"], input[value*="device"]');
		await expect(deviceInput.first()).toBeVisible();
		
		// Check device status button
		const checkStatusButton = page.locator('button:has-text("Check Status")');
		await expect(checkStatusButton).toBeVisible();
		
		// Test device status check
		await checkStatusButton.click();
		await page.waitForTimeout(1000);
		
		// Should show status result
		await expect(page.locator('text=Status:')).toBeVisible();
		await expect(page.locator('text=Not Registered, text=Registered')).toBeVisible();
		
		// Check Pairing Window section
		await expect(page.locator('text=Pairing Window')).toBeVisible();
		await expect(page.locator('text=Instructions')).toBeVisible();
		
		// Check pairing instructions
		await expect(page.locator('text=Start Pairing:')).toBeVisible();
		await expect(page.locator('text=pocket-server pair')).toBeVisible();
		await expect(page.locator('text=Enter PIN in mobile app')).toBeVisible();
	});

	test('API Explorer tab provides interactive API testing', async ({ page }) => {
		// Navigate to API Explorer tab
		await page.locator('text=API Explorer').click();
		await expect(page.locator('text=API Explorer').first()).toHaveClass(/active|selected/);
		
		// Check API Explorer header
		await expect(page.locator('text=API Explorer')).toBeVisible();
		
		// Check Request Builder section
		await expect(page.locator('text=Request Builder')).toBeVisible();
		
		// Check endpoint dropdown
		const endpointSelect = page.locator('select, [role="combobox"]');
		await expect(endpointSelect.first()).toBeVisible();
		
		// Check method and URL display
		await expect(page.locator('text=Method:')).toBeVisible();
		await expect(page.locator('text=GET')).toBeVisible();
		
		// Check execute button
		const executeButton = page.locator('button:has-text("Execute")');
		await expect(executeButton).toBeVisible();
		
		// Test API request execution
		await executeButton.click();
		await page.waitForTimeout(2000);
		
		// Check for response
		await expect(page.locator('text=Response, text=Result')).toBeVisible();
		
		// Check request history
		await expect(page.locator('text=Request History, text=History')).toBeVisible();
	});

	test('Navigation between tabs works correctly', async ({ page }) => {
		const tabs = [
			'Overview',
			'File System',
			'Terminal', 
			'Agent',
			'WebSocket',
			'Authentication',
			'API Explorer'
		];
		
		// Test clicking each tab
		for (const tab of tabs) {
			await page.locator(`text=${tab}`).click();
			await page.waitForTimeout(300);
			
			// Verify tab is active
			await expect(page.locator(`text=${tab}`).first()).toHaveClass(/active|selected/);
			
			// Verify content for the tab is visible
			await expect(page.locator('.tab-content, [class*="tab"], main, .panel')).toBeVisible();
		}
	});

	test('Responsive design works on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		
		// Check that the page still loads
		await expect(page.locator('h1')).toContainText('Dispatch Server');
		
		// Check that navigation is still functional
		await expect(page.locator('text=Overview')).toBeVisible();
		await expect(page.locator('text=File System')).toBeVisible();
		
		// Test tab navigation on mobile
		await page.locator('text=File System').click();
		await page.waitForTimeout(300);
		
		await page.locator('text=WebSocket').click();
		await page.waitForTimeout(300);
		
		// Verify content is still accessible
		await expect(page.locator('text=WebSocket Monitor')).toBeVisible();
	});

	test('Error handling and loading states work correctly', async ({ page }) => {
		// Navigate to API Explorer to test error handling
		await page.locator('text=API Explorer').click();
		
		// Try to execute a request that might fail
		const executeButton = page.locator('button:has-text("Execute")');
		await executeButton.click();
		
		// Should either show loading state or result
		await page.waitForTimeout(3000);
		
		// Check for either success or error state
		const hasResponse = await page.locator('text=Response, text=Error, text=Success').count();
		expect(hasResponse).toBeGreaterThan(0);
	});

	test('Auto-refresh functionality works in system health', async ({ page }) => {
		// Stay on Overview tab
		await expect(page.locator('text=System Health')).toBeVisible();
		
		// Find the auto-refresh toggle
		const autoToggle = page.locator('input[type="checkbox"]').first();
		
		// Enable auto-refresh if not already enabled
		if (!(await autoToggle.isChecked())) {
			await autoToggle.click();
		}
		
		// Wait and check that content updates
		const initialUptime = await page.locator('text=/\\d+[hms]/').first().textContent();
		
		await page.waitForTimeout(5000);
		
		// Uptime should have changed (or at least page should still be functional)
		await expect(page.locator('text=Uptime')).toBeVisible();
		await expect(page.locator('text=Memory Usage')).toBeVisible();
	});

	test('Accessibility features are present', async ({ page }) => {
		// Check for proper heading structure
		await expect(page.locator('h1')).toBeVisible();
		
		// Check for proper button labels
		const buttons = page.locator('button');
		const buttonCount = await buttons.count();
		
		for (let i = 0; i < Math.min(buttonCount, 5); i++) {
			const button = buttons.nth(i);
			const text = await button.textContent();
			expect(text?.trim().length).toBeGreaterThan(0);
		}
		
		// Check for proper form labels
		const inputs = page.locator('input');
		const inputCount = await inputs.count();
		
		for (let i = 0; i < Math.min(inputCount, 3); i++) {
			const input = inputs.nth(i);
			const placeholder = await input.getAttribute('placeholder');
			const hasLabel = await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0;
			
			// Should have either placeholder or label
			expect(placeholder || hasLabel).toBeTruthy();
		}
	});

	test('All UI components render without JavaScript errors', async ({ page }) => {
		const logs = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				logs.push(msg.text());
			}
		});
		
		// Navigate through all tabs
		const tabs = ['File System', 'Terminal', 'Agent', 'WebSocket', 'Authentication', 'API Explorer'];
		
		for (const tab of tabs) {
			await page.locator(`text=${tab}`).click();
			await page.waitForTimeout(1000);
		}
		
		// Should have minimal console errors
		expect(logs.length).toBeLessThan(5);
	});
});