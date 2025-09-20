/**
 * Custom server for SvelteKit with WebSocket support
 * Combines SvelteKit's built server with WebSocket capabilities
 */

import { createServer } from 'http';
import { handler } from '../build/handler.js';
import { wsManager } from './lib/websocket.js';
import { logger } from './lib/shared/logger.js';
import { createStartupBanner } from './lib/shared/terminal-ui.js';

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(handler);

// Initialize WebSocket manager
wsManager.initialize(server);

// Start server
server.listen(PORT, () => {
  console.log(createStartupBanner(PORT));
  logger.info('Server', 'Started successfully', { port: PORT, pid: process.pid });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Server', 'Shutting down...');
  wsManager.close();
  server.close(() => {
    logger.info('Server', 'Shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Server', 'Shutting down...');
  wsManager.close();
  server.close(() => {
    logger.info('Server', 'Shutdown complete');
    process.exit(0);
  });
});