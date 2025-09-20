# Playwright Test Suite Documentation

## Overview

This repository includes a comprehensive Playwright E2E test suite that validates all UI features of the SvelteKit-converted Dispatch Server dashboard. The tests are organized into three main files covering different aspects of the application.

## Test Files

### 1. `tests/e2e.spec.js` - Core UI Tests
**Purpose**: Tests basic UI functionality, navigation, and component rendering across all dashboard tabs.

**Coverage**:
- ✅ Dashboard loading and navigation tabs
- ✅ Overview tab (System Health + Authentication)
- ✅ File System tab (browsing and search)
- ✅ Terminal tab (session management)
- ✅ Agent tab (AI session management)
- ✅ WebSocket tab (connection monitoring)
- ✅ Authentication tab (device management)
- ✅ API Explorer tab (interactive testing)
- ✅ Responsive design (mobile/tablet)
- ✅ Accessibility features
- ✅ Error handling and loading states

### 2. `tests/features.spec.js` - Advanced Feature Tests
**Purpose**: Tests complex feature interactions, data flow, and edge cases.

**Coverage**:
- ✅ End-to-end file system operations
- ✅ Real terminal command execution
- ✅ Agent session lifecycle management
- ✅ WebSocket connection and messaging
- ✅ Multi-endpoint API testing
- ✅ Device authentication workflow
- ✅ Auto-refresh functionality
- ✅ Tab state persistence
- ✅ Performance under load
- ✅ Mobile responsive behavior

### 3. `tests/integration.spec.js` - Integration Tests
**Purpose**: Tests component integration with real APIs and data consistency.

**Coverage**:
- ✅ Real-time system health data
- ✅ Authentication API integration
- ✅ File system API connectivity
- ✅ API Explorer with real requests
- ✅ WebSocket real connection handling
- ✅ Terminal session creation and management
- ✅ Agent session persistence
- ✅ Component state management
- ✅ Cross-tab data consistency
- ✅ Error handling in API components

## Test Scenarios

### Core Functionality Tests
1. **Dashboard Navigation**: Verify all 7 tabs load and display correctly
2. **System Monitoring**: Real-time health data display and auto-refresh
3. **File Operations**: Browse directories, search files, view content
4. **Terminal Management**: Create sessions, execute commands, view output
5. **Agent Sessions**: Create, manage, and persist AI conversation sessions
6. **WebSocket Communication**: Connect, send messages, monitor connection status
7. **Authentication**: Device registration check and pairing workflow
8. **API Testing**: Interactive endpoint testing with response visualization

### Advanced Interaction Tests
1. **Multi-tab Workflows**: Operations spanning multiple dashboard sections
2. **Real-time Updates**: Auto-refresh and live data synchronization
3. **State Persistence**: Data retention across tab navigation
4. **Error Recovery**: Graceful handling of API failures and network issues
5. **Performance**: Rapid interactions and load testing
6. **Responsive Design**: Mobile and tablet compatibility
7. **Accessibility**: Keyboard navigation and screen reader support

### Integration & Data Flow Tests
1. **API Integration**: All endpoints return expected data structures
2. **WebSocket Protocol**: Real connection handling and message flow
3. **File System Access**: Actual file operations with security boundaries
4. **Session Management**: Terminal and agent session lifecycle
5. **Authentication Flow**: Device registration and pairing process
6. **Data Consistency**: Cross-component data synchronization
7. **Component Cleanup**: Memory management and state cleanup

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Test Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e.spec.js

# Run tests in headed mode (with browser UI)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug

# Generate test report
npx playwright test --reporter=html
```

### Test Configuration
Tests are configured in `playwright.config.js`:
- **Base URL**: `http://localhost:5173` (dev server)
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome
- **Retries**: 2 retries in CI, 0 in local development
- **Timeout**: 30 seconds per test
- **Auto-start**: Dev server automatically starts before tests

## Test Structure

### Test Organization
```
tests/
├── e2e.spec.js         # Core UI functionality tests
├── features.spec.js    # Advanced feature interaction tests
├── integration.spec.js # API integration and data flow tests
└── api.test.js        # Vitest unit tests for API endpoints
```

### Test Patterns
Each test file follows consistent patterns:

1. **Setup**: Navigate to dashboard and verify basic loading
2. **Isolation**: Each test is independent and can run in any order
3. **Assertions**: Clear expectations for UI state and data
4. **Cleanup**: No persistent state between tests
5. **Error Handling**: Graceful handling of missing elements

### Page Object Model
Tests use direct selectors with fallback strategies:
- Primary: Semantic selectors (`text=Button Name`)
- Secondary: CSS class selectors (`[class*="component"]`)
- Fallback: Attribute selectors (`button[aria-label="Action"]`)

## Coverage Matrix

| Component | Navigation | Interaction | Data Flow | Error Handling | Mobile |
|-----------|------------|-------------|-----------|----------------|--------|
| Overview | ✅ | ✅ | ✅ | ✅ | ✅ |
| File System | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terminal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agent | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authentication | ✅ | ✅ | ✅ | ✅ | ✅ |
| API Explorer | ✅ | ✅ | ✅ | ✅ | ✅ |

## Expected Results

### Successful Test Run
- **Total Tests**: ~50 test scenarios across 3 files
- **Duration**: 5-10 minutes for full suite
- **Pass Rate**: 95%+ (some tests may be flaky due to timing)
- **Browsers**: All tests should pass on Chrome, Firefox, Safari
- **Mobile**: All responsive tests should pass on mobile viewports

### Common Issues
1. **Timing Issues**: Use `page.waitForTimeout()` for dynamic content
2. **Element Not Found**: Tests include fallback selectors
3. **API Dependencies**: Some tests require running dev server
4. **WebSocket Connections**: May fail if WebSocket service is down

## Maintenance

### Adding New Tests
1. Choose appropriate test file based on test type
2. Follow existing patterns for setup and assertions
3. Include responsive and accessibility checks
4. Add error handling for optional elements
5. Update this documentation with new coverage

### Debugging Failed Tests
1. Run tests in headed mode: `--headed`
2. Use debug mode: `--debug`
3. Check test output and screenshots
4. Verify dev server is running and accessible
5. Check browser console for JavaScript errors

## Integration with CI/CD

The test suite is designed to integrate with CI/CD pipelines:
- Tests run in headless mode by default
- Automatic retry on failure
- HTML reports generated for analysis
- Screenshots captured on failure
- Cross-browser validation included

This comprehensive test suite ensures that all SvelteKit conversion features work correctly and maintain compatibility across different browsers and devices.