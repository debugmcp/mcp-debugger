# tests/unit/proxy/proxy-manager-test-setup.ts
@source-hash: 6a1344462d12f434
@generated: 2026-02-10T00:41:30Z

## Purpose
Test utility module for managing unhandled promise rejections during ProxyManager timeout tests. Provides controlled handling of expected timeout exceptions to prevent test noise while preserving error detection for genuine issues.

## Key Functions

**setupTimeoutTestHandler() (L11-35)**
- Installs custom unhandled rejection handler for test environment
- Captures original process handler before replacement (L13)
- Filters expected timeout rejections based on message patterns (L18-20):
  - "Proxy initialization timeout"
  - "Timeout waiting for DAP response"
- Silently ignores expected timeouts, forwards unexpected rejections to original handler or console
- Completely replaces process unhandled rejection listeners (L33-34)

**cleanupTimeoutTestHandler() (L40-45)**
- Removes custom handler and resets module state
- Should be called in test teardown to restore normal error handling

## State Management
- **unhandledRejectionHandler (L6)**: Tracks active custom handler instance
- Module maintains single global handler state

## Dependencies
- Node.js process events API for unhandled rejection management
- Relies on specific error message patterns from ProxyManager implementation

## Usage Pattern
Designed for test setup/teardown cycle where timeout tests are expected to generate unhandled rejections that should not fail the test suite. Critical for maintaining clean test output while preserving error detection capabilities.