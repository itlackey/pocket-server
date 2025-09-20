import { expect, test, describe } from 'vitest';

/**
 * Background Agent API Tests
 * Tests the Phase 3 background agent functionality
 */

const BASE_URL = 'http://localhost:3000';

describe('Background Agent API', () => {
  test('Status endpoint returns system information', async () => {
    const response = await fetch(`${BASE_URL}/api/background`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('manager');
    expect(data).toHaveProperty('queue');
    expect(data).toHaveProperty('tracker');
    expect(data).toHaveProperty('timestamp');

    // Manager status
    expect(data.manager).toHaveProperty('agents');
    expect(data.manager).toHaveProperty('tasks');
    expect(data.manager).toHaveProperty('queue');

    // Queue status
    expect(data.queue).toHaveProperty('queue');
    expect(data.queue).toHaveProperty('tasks');
    expect(data.queue).toHaveProperty('options');

    // Tracker status
    expect(data.tracker).toHaveProperty('tracked');
    expect(data.tracker).toHaveProperty('completed');
    expect(data.tracker).toHaveProperty('isRunning');
    expect(data.tracker).toHaveProperty('agents');
  });

  test('Task submission works', async () => {
    const taskPayload = {
      type: 'test-task',
      payload: { message: 'Hello World', value: 42 },
      options: { priority: 1 }
    };

    const response = await fetch(`${BASE_URL}/api/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload)
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('task');
    expect(data.task).toHaveProperty('id');
    expect(data.task).toHaveProperty('type', 'test-task');
    expect(data.task).toHaveProperty('status', 'pending');
    expect(data.task).toHaveProperty('createdAt');
  });

  test('Task validation works', async () => {
    // Test missing type
    const response1 = await fetch(`${BASE_URL}/api/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { test: true } })
    });

    expect(response1.status).toBe(400);
    const data1 = await response1.json();
    expect(data1).toHaveProperty('error', 'Task type is required');

    // Test missing payload
    const response2 = await fetch(`${BASE_URL}/api/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });

    expect(response2.status).toBe(400);
    const data2 = await response2.json();
    expect(data2).toHaveProperty('error', 'Task payload is required');
  });

  test('Task appears in status after submission', async () => {
    // Submit a task
    const response = await fetch(`${BASE_URL}/api/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'status-test',
        payload: { test: 'status tracking' }
      })
    });

    expect(response.ok).toBe(true);
    const taskData = await response.json();
    expect(taskData.success).toBe(true);

    // Check status endpoint
    const statusResponse = await fetch(`${BASE_URL}/api/background`);
    expect(statusResponse.ok).toBe(true);

    const statusData = await statusResponse.json();
    expect(statusData.manager.tasks.total).toBeGreaterThan(0);
    expect(statusData.manager.tasks.pending).toBeGreaterThan(0);
  });
});