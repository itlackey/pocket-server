# Test Structure

This directory contains organized tests for the Dispatch Server project.

## Directory Structure

```text
tests/
├── e2e/           # End-to-end tests (Playwright)
├── unit/          # Unit tests (Vitest)
├── integration/   # Integration tests (reserved for future use)
└── README.md      # This file
```

## Test Types

### E2E Tests (`tests/e2e/*.spec.js`)

End-to-end tests using Playwright that test the complete user workflows through the browser interface.

- **`dashboard.spec.js`** - Comprehensive dashboard navigation and UI tests
- **`features.spec.js`** - Feature-specific integration tests
- **`integration.spec.js`** - Component integration and data flow tests
- **`terminal-display.spec.js`** - Terminal UI interaction tests
- **`terminal-websocket-basic.spec.js`** - WebSocket terminal functionality tests

**Run E2E tests:**

```bash
npm run test:e2e                 # Run all E2E tests (Chromium only)
npm run test:e2e:headed          # Run with browser UI visible
npm run test:e2e:debug           # Run in debug mode
ALL_BROWSERS=1 npm run test:e2e  # Run across all browsers
```

### Unit Tests (`tests/unit/*.test.js`)

Unit tests using Vitest that test individual modules and functions in isolation.

- **`agent-anthropic.test.js`** - Anthropic AI agent tests
- **`agent-providers.test.js`** - AI provider switching tests (OpenAI, Anthropic)
- **`agent-tools.test.js`** - AI agent tools tests
- **`api.test.js`** - API endpoint unit tests
- **`auth.test.js`** - Authentication module tests
- **`background-agent.test.js`** - Background agent processing tests
- **`notifications.test.js`** - Notification system tests
- **`notifications-api.test.js`** - Notifications API endpoint tests
- **`websocket-terminal.test.js`** - WebSocket and terminal manager unit tests

**Run unit tests:**

```bash
npm test                    # Run all unit tests
npm run test:coverage       # Run with coverage report
npm test -- --watch        # Run in watch mode
```

### Run All Tests

```bash
npm run test:all           # Run both unit and E2E tests
```

## Test Configuration

- **Playwright Config**: `playwright.config.js` - E2E test configuration
- **Vitest Config**: `vitest.config.js` - Unit test configuration

## Test Development Guidelines

### E2E Tests

- Use `.spec.js` extension for E2E tests
- Test complete user workflows and UI interactions
- Focus on critical user paths and cross-browser compatibility
- Use proper selectors that won't break with UI changes
- Include proper waiting and error handling

### Unit Tests

- Use `.test.js` extension for unit tests
- Test individual functions and modules in isolation
- Mock external dependencies appropriately
- Aim for high code coverage on core business logic
- Write fast, reliable tests that don't depend on external services

### Naming Conventions

- **E2E files**: `feature-name.spec.js` (e.g., `terminal-display.spec.js`)
- **Unit files**: `module-name.test.js` (e.g., `websocket-terminal.test.js`)
- **Test descriptions**: Use clear, descriptive names that explain what is being tested

## CI/CD Integration

- E2E tests run with retries in CI environments
- Unit tests must pass for all commits
- Coverage reports are generated for unit tests
- Tests are optimized for both development and CI performance
