# tests/test-utils/helpers/test-utils.ts
@source-hash: 98776f1ccfde2eda
@generated: 2026-02-09T18:14:41Z

## Primary Purpose
Test utilities module providing comprehensive helper functions for Debug MCP Server testing, focusing on session mocking, async condition waiting, event handling, file system operations, and proxy process simulation.

## Key Functions

### Core Test Utilities
- **createMockSession** (L14-27): Creates mock DebugSession objects with configurable overrides, defaulting to Python language and CREATED state
- **delay** (L221-223): Simple promise-based delay utility
- **withTimeout** (L232-239): Wraps functions with timeout protection using Promise.race

### Async Condition & Event Handling
- **waitForCondition** (L37-53): Polls condition function until true or timeout (5s default), with configurable intervals (100ms default)
- **waitForEvent** (L63-81): Returns promise resolving when specific event fires on EventEmitter, with cleanup on timeout
- **waitForEvents** (L91-99): Sequentially waits for array of events using waitForEvent internally

### Event Emitter Mocking
- **createMockEventEmitter** (L104-161): Creates complete EventEmitter mock with vitest spies, tracking listeners internally and supporting once/on/emit/removeListener/removeAllListeners methods

### File System Testing
- **createTempTestFile** (L180-198): Creates files in OS temp directory under 'debug-mcp-tests' subfolder
- **cleanupTempTestFiles** (L203-213): Removes entire temp test directory recursively

### Mock Factories
- **mockAsyncFunction** (L169-171): Creates vitest mock returning resolved promise with given value
- **createMockLogger** (L319-326): Creates ILogger mock with info/error/warn/debug spies
- **createMockFileSystem** (L332-351): Creates comprehensive IFileSystem mock with all methods stubbed with sensible defaults

### Proxy Testing Utilities
- **createFakeProxyProcess** (L252-270): Creates FakeProcess configured to handle 'terminate' command messages
- **setupProxyManagerTest** (L276-313): Complete test setup factory returning ProxyManager instance with all dependencies mocked (launcher, filesystem, logger)

## Dependencies
- EventEmitter from Node.js 'events'
- @debugmcp/shared types (DebugLanguage, SessionState, DebugSession)
- uuid for session ID generation
- vitest for mocking (`vi.fn()`)
- Internal test doubles: FakeProxyProcessLauncher, FakeProcess
- ProxyManager and interface types from main source

## Architecture Notes
- Functions are pure/stateless except for file system utilities which create/cleanup temp directories
- Event utilities properly handle cleanup to prevent memory leaks
- Mock factories return fully-configured objects following dependency injection patterns
- Proxy test utilities abstract complex setup into single function calls