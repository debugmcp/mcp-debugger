# tests\test-utils/
@children-hash: 6d89aa70397e4a68
@generated: 2026-02-15T09:02:00Z

## Test Utilities Infrastructure for MCP Debug Server

**Purpose**: Comprehensive testing infrastructure providing utilities, fixtures, mocks, and helpers to enable isolated, reliable testing of the MCP Debug Server across unit, integration, and end-to-end test scenarios.

## Key Components and Architecture

### Core Testing Utilities
- **Promise Tracking (`promise-tracker.ts`)** - Memory leak detection for promises across test sessions with lifecycle tracking and cleanup verification
- **Environment Detection (`python-environment.ts`)** - Runtime environment validation for Python interpreter and debugpy module availability
- **Session Management (`session-id-generator.ts`)** - Unique test session ID generation with bidirectional encoding for resource correlation and debugging

### Test Infrastructure (`helpers/`)
**Resource Management Layer:**
- Port allocation system preventing test conflicts with dedicated ranges per test type
- Global process lifecycle management with auto-cleanup and graceful termination
- Temporary resource management for isolated test environments

**Mock and Setup Layer:**
- Complete dependency injection containers with both fake and vitest mock variants
- Specialized factories for SessionManager and core components with proper isolation
- Event/timing utilities, file management, and proxy testing framework integration

**Debug Testing Support:**
- Debugging session utilities wrapping DebugMcpServer functionality
- CLI test execution scripts with coverage reporting and failure analysis

### Test Fixtures (`fixtures/`)
**Python Debugging Fixtures:**
- Script templates for automated test generation (loops, functions, recursion, exceptions, multi-module)
- Live Python processes for runtime debugging attachment scenarios
- DAP server implementations with configurable debugging scenarios

### Comprehensive Mocking (`mocks/`)
**System Interface Mocks:**
- Complete Node.js subsystem replacements (child_process, net, fs-extra)
- Environment and command resolution mocking with configurable responses

**Debug Protocol Mocks:**
- Full DAP client/server simulation with event patterns and error injection
- Proxy manager mocks with lifecycle management and command simulation
- Debug adapter registry mocking with language support and error scenarios

## Public API Surface

### Main Entry Points
- **Resource Management**: `portManager`, `processTracker` singletons for global coordination
- **Test Setup**: `createTestDependencies()`, `createTestSessionManager()` factory functions
- **Environment Validation**: `isPythonAvailable()`, `isDebugpyAvailable()` detection utilities
- **Session Tracking**: `getTestSessionId()`, promise tracking utilities for leak detection

### Mock Infrastructure
- **Process Testing**: `childProcessMock`, `MockProxyManager` for subprocess simulation
- **DAP Testing**: `mockDapClient`, adapter registry mocks for protocol testing
- **Fixture Access**: Python script templates and executable debugging targets

### Debug Testing Support
- SessionHelpers for integration testing with singleton debug server instances
- CLI utilities for test execution with clean output formatting and coverage reporting

## Internal Organization and Data Flow

### Test Lifecycle Architecture
1. **Setup Phase**: Factories create isolated environments with dependency injection
2. **Resource Allocation**: Port and process managers assign unique resources
3. **Execution Phase**: Mocks provide controlled behavior, fixtures enable realistic scenarios
4. **Cleanup Phase**: Automated resource cleanup prevents test pollution and memory leaks

### Cross-Component Integration
- **Session-Based Tracking**: Session IDs correlate across promise tracking, resource management, and debugging utilities
- **Resource Coordination**: Singleton managers ensure no conflicts between concurrent test execution
- **Mock Ecosystem**: Layered mocks from low-level system interfaces to high-level application services
- **Fixture Pipeline**: Template generation → script execution → debugging attachment → validation

## Important Patterns and Conventions

### Design Principles
- **Test Isolation**: Each test gets dedicated resources (ports, processes, sessions) with automatic cleanup
- **Deterministic Behavior**: Mocks use event-driven patterns with predictable timing via `process.nextTick()`
- **Progressive Complexity**: Fixtures range from simple loops to multi-module debugging scenarios
- **Defensive Testing**: Comprehensive error injection capabilities for robust failure scenario testing

### Integration Points
- Vitest framework integration for mocking and assertions
- VSCode Debug Adapter Protocol compatibility for realistic debugging simulation
- CI/CD pipeline support through CLI utilities and coverage reporting
- Cross-platform compatibility with fallback strategies for different environments

This test utilities directory provides a complete testing ecosystem enabling comprehensive validation of the MCP Debug Server without external dependencies, ensuring tests are fast, reliable, and maintainable.