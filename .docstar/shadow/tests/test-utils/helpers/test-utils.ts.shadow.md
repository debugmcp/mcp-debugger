# tests/test-utils/helpers/test-utils.ts
@source-hash: 98776f1ccfde2eda
@generated: 2026-02-10T00:41:32Z

## Purpose
Test utilities for the Debug MCP Server testing framework, providing mock objects, event handling helpers, timing utilities, and specialized fake implementations for proxy processes.

## Key Functions

### Mock Creation Utilities
- `createMockSession(L14-27)` - Creates mock DebugSession objects with configurable overrides, defaulting to Python language and CREATED state
- `createMockEventEmitter(L104-161)` - Creates vitest-mocked EventEmitter with internal listener tracking
- `mockAsyncFunction(L169-171)` - Creates vitest mock functions that return resolved promises
- `createMockLogger(L319-326)` - Creates ILogger mock with all logging methods
- `createMockFileSystem(L332-351)` - Creates IFileSystem mock with default successful responses

### Event & Timing Utilities
- `waitForCondition(L37-53)` - Polls condition function until true or timeout (default 5s)
- `waitForEvent(L63-81)` - Promise that resolves when specific EventEmitter event fires
- `waitForEvents(L91-99)` - Waits for multiple events in sequence
- `delay(L221-223)` - Simple timeout promise wrapper
- `withTimeout(L232-239)` - Races function execution against timeout rejection

### File System Test Helpers
- `createTempTestFile(L180-198)` - Creates temporary files in OS temp directory under 'debug-mcp-tests'
- `cleanupTempTestFiles(L203-213)` - Removes entire temp test directory

### Proxy Testing Framework
- `createFakeProxyProcess(L252-270)` - Creates FakeProcess with terminate message handling
- `setupProxyManagerTest(L276-313)` - Complete ProxyManager test setup with all mock dependencies

## Dependencies
- **@debugmcp/shared**: DebugLanguage, SessionState, DebugSession types
- **uuid**: Session ID generation
- **vitest**: Mock framework (vi.fn())
- **Internal**: FakeProxyProcessLauncher, ProxyManager, interface types

## Architecture Notes
- Uses Node.js require() for fs/path/os modules in temp file functions rather than imports
- Mock event emitter maintains internal listener state for proper cleanup
- Proxy test utilities integrate with fake process implementation system
- All timing functions use configurable timeouts with sensible defaults
- File system operations target isolated temp directory for test safety

## Critical Patterns
- Mock objects provide vitest spy functions for assertion verification
- Event utilities handle cleanup to prevent memory leaks
- Temp file operations are scoped to prevent test interference
- Proxy mocks simulate real process lifecycle including termination handling