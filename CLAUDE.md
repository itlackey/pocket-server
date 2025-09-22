# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dispatch Server is a SvelteKit application that provides a WebSocket server with AI agent capabilities, file system operations, and terminal management. It serves as the backend for the Pocket Agent mobile app, enabling mobile control of coding agents, terminals, and file operations.

## Architecture

### Tech Stack
- **Framework**: SvelteKit with Node adapter
- **WebSocket**: Custom WebSocket implementation via Vite plugin for dev, native ws in production
- **AI Agents**: Supports Anthropic Claude and OpenAI GPT models
- **Terminal**: node-pty for PTY sessions
- **Type System**: JavaScript with JSDoc types (jsconfig.json)

### Directory Structure

```
src/
├── routes/               # SvelteKit routes and API endpoints
│   └── +server.js       # Main server routes
├── lib/                 # Core business logic
│   ├── agent/           # AI agent implementation
│   │   ├── anthropic/   # Anthropic Claude integration
│   │   └── store/       # Session persistence
│   ├── auth/            # Authentication & device pairing
│   ├── file-system/     # File operations and search
│   ├── terminal/        # Terminal management (PTY)
│   └── shared/          # Shared utilities and types
├── hooks.server.js      # SvelteKit server hooks
└── server.js            # WebSocket server implementation
```

## Development Commands

```bash
# Development
npm run dev              # Start Vite dev server on port 3000
npm run preview          # Preview production build

# Building
npm run build            # Build SvelteKit app to build/
npm start                # Run production server

# Testing
npm test                 # Run Vitest tests
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:headed  # Run Playwright with browser UI
npm run test:e2e:debug   # Debug Playwright tests
npm run test:coverage    # Run tests with coverage
npm run test:all         # Run all tests (unit + E2E)

# Code Quality
npm run lint             # Biome linting (strict, gates releases)
npm run check            # SvelteKit sync and type checking
npm run check:watch      # Watch mode for type checking

# Utilities
npm run rebuild:native   # Rebuild node-pty native bindings
npm run playwright:install # Install Playwright browsers
```

## WebSocket Protocol

All WebSocket messages follow this structure:
```javascript
{
  v: 1,                    // Protocol version
  type: string,            // Message type (namespaced)
  id: string,              // Unique message ID
  sessionId: string,       // Session identifier
  correlationId?: string,  // Request/response pairing
  ts: string,              // ISO timestamp
  seq: number,             // Sequence number
  payload?: any            // Type-specific payload
}
```

Message namespaces:
- `agent:*` - AI agent operations
- `fs:*` - File system operations
- `term:*` - Terminal I/O
- `ws:*` - WebSocket meta events
- `auth:*` - Authentication events

## Authentication Flow

1. Device pairing (local network only)
2. Token generation with HMAC-SHA256 signatures
3. Short-lived tokens (5 minutes)
4. HTTP: `Authorization: Pocket <token>`
5. WebSocket: `?token=<token>` query parameter

## Testing Strategy

- **Unit tests**: Use Vitest, co-located with source files
- **E2E tests**: Playwright in `tests/` directory
- **Run specific test**: `npm test -- path/to/test.js`
- **Debug E2E**: `npm run test:e2e:debug`

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Anthropic Claude API
OPENAI_API_KEY=sk-...         # OpenAI GPT API
PORT=3000                      # Server port (default 3000)
```

## Adding New Features

### New API Endpoint
1. Create `+server.js` in appropriate route directory
2. Export handler functions (GET, POST, etc.)
3. Use `$lib/shared/types/` for type definitions

### New WebSocket Handler
1. Add handler in `src/server.js` WebSocket connection handler
2. Follow message envelope structure
3. Use appropriate namespace for message type

### New AI Tool
1. Create tool in `src/lib/agent/anthropic/tools/`
2. Export tool with schema and handler
3. Register in agent implementation

## Key Implementation Details

### WebSocket Streaming
- Frame aggregation for terminal output
- Heartbeat ping/pong every 30s
- Automatic reconnection handling

### Session Management
- Sessions stored in `data/sessions/`
- Snapshot-based persistence
- Event log for audit trail

### Terminal Management
- PTY sessions via node-pty
- Output buffering and frame aggregation
- Session attach/detach support

### File Operations
- Path validation and traversal prevention
- Fuzzy search with fuzzysort
- Chokidar for file watching

## Common Patterns

### Error Handling
```javascript
try {
  // Operation
  return { ok: true, result };
} catch (error) {
  logger.error('Module', 'operation failed', { error });
  return { ok: false, error: error.message };
}
```

### WebSocket Message Sending
```javascript
ws.send(JSON.stringify({
  v: 1,
  type: 'namespace:event',
  id: randomUUID(),
  sessionId,
  ts: new Date().toISOString(),
  seq: sequenceNumber++,
  payload: data
}));
```

### Type Definitions (JSDoc)
```javascript
/**
 * @typedef {Object} MessageEnvelope
 * @property {number} v - Protocol version
 * @property {string} type - Message type
 * @property {string} id - Unique ID
 * @property {string} sessionId - Session ID
 * @property {string} ts - ISO timestamp
 * @property {number} seq - Sequence number
 * @property {any} [payload] - Message payload
 */
```

## Debugging

- Check WebSocket messages in browser DevTools
- Monitor server logs for errors
- Use `npm run check` for type validation
- Test WebSocket locally: `ws://localhost:3000/ws?token=<token>`
- Review session data in `data/sessions/<id>/`