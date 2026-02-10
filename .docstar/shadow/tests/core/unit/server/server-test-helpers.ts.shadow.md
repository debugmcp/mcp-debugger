# tests/core/unit/server/server-test-helpers.ts
@source-hash: d9b4a6fbcdee726f
@generated: 2026-02-09T18:14:20Z

## Purpose
Test utility file providing mock factories for server-related unit tests. Creates comprehensive mock implementations of core server dependencies including file systems, process managers, and debugging components.

## Key Functions

### createMockDependencies() (L8-73)
Main mock factory that returns a complete set of mocked server dependencies:
- **logger**: Mock logger instance from test utilities
- **fileSystem**: Comprehensive file system mock with all fs operations (existsSync, readFile, writeFile, etc.) - mostly returns success values
- **processManager, networkManager, processLauncher, proxyProcessLauncher, debugTargetLauncher**: All mocked as vi.fn()
- **environment**: Mock environment with access to real process.env and cwd
- **pathUtils**: Platform-aware path manipulation mocks with simplified implementations (L43-70)
- **adapterRegistry**: Mock adapter registry from test utilities

### createMockServer() (L75-82) 
Creates mock server instance with connection lifecycle methods (setRequestHandler, connect, close)

### createMockSessionManager() (L84-104)
Creates comprehensive mock debugging session manager with all debug operations (breakpoints, stepping, variables, evaluation, etc.)

### createMockStdioTransport() (L106-108)
Empty mock transport object

### getToolHandlers() (L110-116)
Utility to extract registered tool handlers from mock server, assumes specific handler order (listTools first, callTool second)

## Dependencies
- `vitest` for mock functions
- Test utilities for logger and adapter registry mocks
- Assumes specific server architecture with tool-based request handling

## Notable Patterns
- Platform-aware path utilities that handle Windows vs Unix paths (L44-51)
- Comprehensive mocking strategy covering all file system operations
- Mock implementations provide realistic behavior (path manipulation actually works)
- Assumes two-handler registration pattern for tools

## Key Mock Behaviors
- File system operations default to success (files exist, operations complete)
- Path utilities use simplified but functional implementations
- Environment access delegates to real process environment
- All complex dependencies (process/network managers) are simple vi.fn() mocks