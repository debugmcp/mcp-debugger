# tests\test-utils/
@generated: 2026-02-12T21:01:30Z

## Purpose
Comprehensive test infrastructure module providing utilities, mocks, fixtures, and helpers for testing the MCP (Model Context Protocol) debugging system. This module creates isolated, deterministic test environments by replacing external dependencies with controlled mocks and providing specialized utilities for debugging workflow testing.

## Key Components and Integration

### Test Infrastructure Core
- **Utilities** (`promise-tracker.ts`, `session-id-generator.ts`, `python-environment.ts`) - Foundation services for test execution tracking, unique identification, and environment detection
- **Helpers** - Complete test environment factories, resource management (ports, processes), and debug session integration
- **Mocks** - Comprehensive mock implementations for all external dependencies (filesystem, network, child processes, debug protocols)

### Test Environment Architecture
The module follows a **dependency injection pattern** where components work together to create isolated test environments:

1. **Resource Management**: Port allocation and process tracking prevent conflicts across concurrent tests
2. **Mock Infrastructure**: Replaces external systems with controllable test doubles
3. **Test Fixtures**: Provides both TypeScript templates and executable Python programs for debugging scenarios
4. **Session Management**: Tracks test execution and enables resource cleanup

### Integration Flow
- **Setup Phase**: Helpers create isolated test environments with injected mock dependencies
- **Execution Phase**: Fixtures provide test scenarios while utilities track resources and sessions
- **Analysis Phase**: Result analyzers and reporting tools process test outcomes
- **Cleanup Phase**: Resource managers and promise tracking ensure proper cleanup

## Public API Surface

### Primary Entry Points

**Test Environment Creation**:
- `createTestDependencies()` - Complete dependency container with fake implementations
- `createMockDependencies()` - Vitest spy-based mocks for all interfaces
- `createTestServer()` - DebugMcpServer optimized for testing
- `createTestSessionManager()` - Pre-configured SessionManager with mock dependencies

**Resource Management Singletons**:
- `portManager` - Centralized port allocation preventing test conflicts
- `processTracker` - Global registry of spawned test processes with automatic cleanup

**Debug Session Integration**:
- `getDebugServer()` - Lazy singleton DebugMcpServer for integration tests
- `createDebugSession()`, `startDebugging()`, `closeDebugSession()` - Complete debug workflow management
- Debug control flow utilities: `continueExecution()`, `stepOver()`, `setBreakpoint()`

**Mock Infrastructure**:
- `childProcessMock` - Child process operations with specialized Python/proxy configurations
- `mockDapClient` - Debug Adapter Protocol client simulation
- `MockProxyManager` - Debug proxy lifecycle and communication
- `createMockAdapterRegistry()` - Debug adapter management with language support

**Test Utilities**:
- `waitForCondition()`, `waitForEvent()` - Async test synchronization
- `trackPromise()`, `resolvePromise()`, `untrackPromise()` - Promise lifecycle tracking for leak detection
- `getTestSessionId()` - Unique session ID generation with test name correlation

### Fixture Collections

**Python Debug Scenarios**:
- TypeScript templates: `simpleLoopScript`, `functionCallScript`, `fibonacciScript`, `exceptionHandlingScript`
- Executable programs: `debug_test_simple.py`, `debugpy_server.py` with CLI options
- Multi-module scenarios for cross-file debugging testing

## Internal Organization and Data Flow

### Layered Architecture
1. **Foundation Layer**: Core utilities (session IDs, promise tracking, environment detection)
2. **Resource Layer**: Managers for ports, processes, and cleanup
3. **Mock Layer**: Test doubles for all external dependencies
4. **Integration Layer**: Factories combining mocks and utilities into complete test environments
5. **Analysis Layer**: Result processing and reporting tools

### Cross-Component Integration
- **Promise Tracking**: Integrates with session management for resource leak detection
- **Mock Coordination**: Multiple mocks work together for complex integration testing (DAP + process + filesystem)
- **Resource Safety**: Port/process managers ensure test isolation and prevent conflicts
- **Session Correlation**: Unique session IDs enable tracing resources back to specific tests

## Important Patterns and Conventions

### Test Isolation
- Each factory creates fresh instances preventing test pollution
- Comprehensive reset mechanisms for all mocks and utilities
- Session-based resource grouping for bulk cleanup

### Error Resilience
- Graceful fallbacks for missing dependencies (Python environment detection)
- Comprehensive error handling with timeout mechanisms
- Defensive programming with null checks and validation

### Developer Experience
- Consistent factory pattern across all components
- Type-safe interfaces ensuring mock/real implementation compatibility
- Rich debugging information with stack traces and timing data
- CI-friendly reporting with clean failure output

This module serves as the complete testing foundation for the MCP debugging system, enabling fast, reliable, and comprehensive testing without external dependencies while maintaining realistic behavior simulation.