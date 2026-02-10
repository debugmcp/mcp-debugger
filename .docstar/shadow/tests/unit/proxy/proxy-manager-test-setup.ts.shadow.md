# tests/unit/proxy/proxy-manager-test-setup.ts
@source-hash: 6a1344462d12f434
@generated: 2026-02-09T18:14:40Z

## Purpose
Test utility module for ProxyManager test suite that manages expected unhandled Promise rejections during timeout testing scenarios. Prevents test noise from expected timeout failures while preserving error handling for genuine issues.

## Key Components

### State Management
- `unhandledRejectionHandler` (L6): Global handler storage for cleanup reference

### Core Functions
- `setupTimeoutTestHandler()` (L11-35): Installs custom unhandled rejection handler
  - Preserves original Node.js handler for non-test rejections
  - Filters expected timeout messages: "Proxy initialization timeout" and "Timeout waiting for DAP response"
  - Silently ignores expected rejections, forwards unexpected ones to original handler
  - Completely replaces process-level rejection handling

- `cleanupTimeoutTestHandler()` (L40-44): Removes custom handler and resets state

## Architecture Patterns
- **Test Isolation**: Provides setup/cleanup pattern for test environment modification
- **Selective Error Suppression**: Uses message pattern matching to distinguish expected vs unexpected failures
- **Handler Preservation**: Maintains original Node.js error handling for non-test scenarios

## Critical Constraints
- Must call `cleanupTimeoutTestHandler()` after tests to restore normal error handling
- Handler replacement affects global process behavior
- Timeout message patterns must match actual ProxyManager implementation
- Only suppresses rejections with specific timeout-related messages

## Dependencies
- Node.js `process` global for unhandled rejection event management
- Expects ProxyManager to throw rejections with specific message patterns during timeout scenarios