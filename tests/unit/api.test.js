import { expect, test } from 'vitest';

/**
 * API Health Tests
 * Tests all API endpoints for correct responses and data structure
 */

const BASE_URL = 'http://localhost:3000';

test('Health endpoint returns system information', async () => {
	const response = await fetch(`${BASE_URL}/api/health`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('uptime');
	expect(data).toHaveProperty('memory');
	expect(data.memory).toHaveProperty('used');
	expect(data.memory).toHaveProperty('total');
	expect(typeof data.uptime).toBe('number');
});

test('Auth device status endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/auth/device/status?deviceId=test-device`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('registered');
	expect(typeof data.registered).toBe('boolean');
});

test('Auth pairing status endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/auth/pair/status`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('active');
	expect(data).toHaveProperty('expiresAt');
	expect(data).toHaveProperty('secondsLeft');
	expect(typeof data.active).toBe('boolean');
});

test('File system list endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/fs/list?path=.`);
	expect(response.ok).toBe(true);

	const data = await response.json();
	expect(data).toHaveProperty('nodes');
	expect(Array.isArray(data.nodes)).toBe(true);
	expect(data).toHaveProperty('path');
});

test('File system search endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/fs/search?query=test&path=.`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(Array.isArray(data)).toBe(true);
	expect(data.length).toBeGreaterThan(0);
});

test('Agent session creation works', async () => {
	const response = await fetch(`${BASE_URL}/api/agent/session`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			workingDir: '/home',
			maxMode: false
		})
	});
	
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('id');
	expect(typeof data.id).toBe('string');
});

test('Agent sessions list endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/agent/sessions`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('sessions');
	expect(Array.isArray(data.sessions)).toBe(true);
});

test('Terminal sessions endpoint works', async () => {
	const response = await fetch(`${BASE_URL}/api/terminal/sessions`);
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('sessions');
	expect(Array.isArray(data.sessions)).toBe(true);
});

test('Terminal session creation works', async () => {
	const response = await fetch(`${BASE_URL}/api/terminal/create`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cwd: '/home',
			cols: 80,
			rows: 24
		})
	});
	
	expect(response.ok).toBe(true);
	
	const data = await response.json();
	expect(data).toHaveProperty('id');
	expect(data).toHaveProperty('created');
	expect(data.created).toBe(true);
});

test('Terminal command execution works', async () => {
	// First create a terminal session
	const createResponse = await fetch(`${BASE_URL}/api/terminal/create`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cwd: '.',
			cols: 80,
			rows: 24
		})
	});

	expect(createResponse.ok).toBe(true);
	const createData = await createResponse.json();
	const sessionId = createData.id;

	// Then execute a command
	const response = await fetch(`${BASE_URL}/api/terminal/execute`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionId: sessionId,
			command: 'echo "Hello World"'
		})
	});

	expect(response.ok).toBe(true);

	const data = await response.json();
	expect(data).toHaveProperty('success');
	expect(data).toHaveProperty('message');
	expect(data).toHaveProperty('command');
	expect(data.success).toBe(true);
	expect(typeof data.message).toBe('string');
	expect(typeof data.command).toBe('string');
});

test('File system write and read operations work', async () => {
	const testContent = 'Test file content for e2e testing';
	const testPath = './test-file.txt';
	
	// Write file
	const writeResponse = await fetch(`${BASE_URL}/api/fs/write`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			path: testPath,
			content: testContent
		})
	});
	
	expect(writeResponse.ok).toBe(true);
	
	// Read file back
	const readResponse = await fetch(`${BASE_URL}/api/fs/read?path=${encodeURIComponent(testPath)}`);
	expect(readResponse.ok).toBe(true);
	
	const readData = await readResponse.json();
	expect(readData).toHaveProperty('content');
	expect(readData.content).toBe(testContent);
	
	// Clean up - delete file
	const deleteResponse = await fetch(`${BASE_URL}/api/fs/delete?path=${encodeURIComponent(testPath)}`, {
		method: 'DELETE'
	});
	expect(deleteResponse.ok).toBe(true);
});

test('Agent session snapshot retrieval works', async () => {
	// First create a session
	const createResponse = await fetch(`${BASE_URL}/api/agent/session`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			workingDir: '/home',
			maxMode: false
		})
	});
	
	const createData = await createResponse.json();
	const sessionId = createData.id;
	
	// Get snapshot
	const snapshotResponse = await fetch(`${BASE_URL}/api/agent/snapshot?sessionId=${sessionId}`);
	expect(snapshotResponse.ok).toBe(true);
	
	const snapshotData = await snapshotResponse.json();
	expect(snapshotData).toHaveProperty('id');
	expect(snapshotData.id).toBe(sessionId);
	
	// Clear session
	await fetch(`${BASE_URL}/api/agent/clear`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sessionId })
	});
});