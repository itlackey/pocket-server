import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected');

  // Send ping first
  ws.send(JSON.stringify({
    v: 1,
    id: 'test-' + Date.now(),
    sessionId: 'test-session',
    ts: new Date().toISOString(),
    timestamp: Date.now(),
    type: 'ping'
  }));

  // Then send terminal open after a short delay
  setTimeout(() => {
    const termId = 'term-' + Date.now();
    console.log('Sending term:open for', termId);
    ws.send(JSON.stringify({
      v: 1,
      id: 'test-' + Date.now(),
      sessionId: 'test-session',
      ts: new Date().toISOString(),
      timestamp: Date.now(),
      type: 'term:open',
      payload: {
        id: termId,
        cwd: '/tmp',
        cols: 80,
        rows: 24
      }
    }));

    // Send a command after terminal opens
    setTimeout(() => {
      console.log('Sending command: echo "Hello World"');
      ws.send(JSON.stringify({
        v: 1,
        id: 'test-' + Date.now(),
        sessionId: 'test-session',
        ts: new Date().toISOString(),
        timestamp: Date.now(),
        type: 'term:input',
        payload: {
          id: termId,
          data: 'echo "Hello World"\n',
          seq: Date.now()
        }
      }));
    }, 1000);
  }, 100);
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', () => {
  console.log('Disconnected');
  process.exit(0);
});

ws.on('error', (error) => {
  console.log('Error:', error.message);
  process.exit(1);
});

setTimeout(() => {
  ws.close();
}, 5000);