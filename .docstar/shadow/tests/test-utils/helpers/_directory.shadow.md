# tests\test-utils\helpers/
@children-hash: f03ad1dd306f66bd
@generated: 2026-02-15T09:01:29Z

## Purpose
Test helper utilities directory providing comprehensive testing infrastructure for the Debug MCP Server. Centralizes test utilities, mock factories, process management, session debugging helpers, and test execution scripts to support isolated, reliable testing across unit, integration, and e2e test suites.

## Key Components

### Resource Management
- **PortManager (`port-manager.ts`)** - Centralized port allocation system preventing conflicts between concurrent tests. Manages dedicated port ranges for different test types (unit: 5679-5779, integration: 5779-5879, e2e: 5879-5979) with fallback allocation and singleton instance pattern.

- **ProcessTracker (`process-tracker.js/.d.ts`)** - Global process lifecycle management preventing orphaned processes during test execution. Tracks spawned processes with auto-cleanup, graceful termination (SIGTERM → SIGKILL), and bulk cleanup capabilities.

### Mock Factories & Test Setup
- **TestDependencies (`test-dependencies.ts`)** - Primary factory for creating isolated test environments with complete dependency injection containers. Provides both fake implementations and vitest mock variants for all core interfaces.

- **TestSetup (`test-setup.ts`)** - Specialized factories for SessionManager and related components with pre-configured mock dependencies. Main entry point for setting up test instances with proper isolation.

- **TestUtils (`test-utils.ts`)** - Core testing utilities providing mock creation helpers, event/timing utilities, temporary file management, and proxy testing framework integration.

### Debug Testing Support
- **SessionHelpers (`session-helpers.ts`)** - Debugging session test utilities wrapping DebugMcpServer functionality. Provides singleton debug server instance with helper functions for session management, breakpoint control, and debug flow operations.

### Test Execution & Reporting
- **Test Summary Scripts** - Collection of CLI utilities for test execution with clean output formatting:
  - `test-summary.js` - Basic pass/fail summary with failure details
  - `test-coverage-summary.js` - Coverage-enabled test runs with minimal reporting
  - `show-failures.js` - Failure-focused output filtering
  - `test-results-analyzer.js` - Multi-level result analysis (summary/failures/detailed)

## Public API Surface

### Main Entry Points
- `portManager` singleton - Global port allocation service
- `processTracker` singleton - Global process lifecycle management
- `createTestDependencies()` - Complete dependency container factory
- `createTestSessionManager()` - Primary SessionManager test factory
- Debug session helpers for integration testing

### Resource Management
- Port allocation with range-based assignment and cleanup
- Process tracking with auto-registration and graceful termination
- Temporary file creation/cleanup in isolated test directories

### Mock Infrastructure
- Complete mock implementations for all core interfaces
- Event emitter mocking with cleanup tracking
- Async function mocking with promise resolution
- File system and network mocking with configurable defaults

## Internal Organization

### Data Flow
1. **Test Setup Phase**: Factories create isolated environments with mock dependencies
2. **Resource Allocation**: PortManager assigns unique ports, ProcessTracker registers spawned processes
3. **Test Execution**: Mock implementations provide controlled behavior for testing
4. **Cleanup Phase**: Automatic resource cleanup prevents test pollution

### Architectural Patterns
- **Singleton Pattern**: Shared resource managers (ports, processes) maintain global state
- **Factory Pattern**: Multiple factory functions for different testing scenarios
- **Dependency Injection**: Complete containerization of test dependencies
- **Auto-cleanup**: Event-driven cleanup prevents resource leaks

### Integration Points
- Integrates with Vitest testing framework for mocking and assertions
- Supports both Node.js child processes and custom process-like objects
- Compatible with VSCode Debug Adapter Protocol for debugging tests
- Provides CLI utilities for CI/CD pipeline integration

## Important Conventions
- All resource managers use singleton patterns for global coordination
- Mock factories return both instances and dependencies for test introspection
- Port ranges are strictly segregated by test type to prevent conflicts
- Process cleanup uses graceful termination with fallback to force-kill
- Temporary files are isolated in dedicated test directories
- Error handling is defensive with comprehensive logging for debugging