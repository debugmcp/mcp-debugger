# tests/test-utils/helpers/
@generated: 2026-02-10T21:26:24Z

## Purpose
Test utilities directory providing comprehensive testing infrastructure for the Debug MCP Server. Contains specialized helpers for process management, session debugging, resource allocation, result analysis, and test environment setup. Designed to support unit, integration, and end-to-end testing with proper isolation and cleanup.

## Key Components and Organization

### Process & Resource Management
- **port-manager.ts**: Centralized port allocation preventing test conflicts with range-based assignment (unit/integration/e2e)
- **process-tracker.js/.d.ts**: Global process lifecycle tracking with automatic cleanup to prevent orphaned processes
- **test-dependencies.ts**: Dependency injection factories providing both fake implementations and vitest mocks

### Session & Debugging Utilities  
- **session-helpers.ts**: Wrapper utilities around DebugMcpServer for integration testing with lazy singleton pattern
- **test-setup.ts**: SessionManager factory functions with configurable mock dependencies and lifecycle simulation
- **test-utils.ts**: Core testing primitives including mock creation, event handling, timing utilities, and temp file management

### Test Execution & Analysis
- **show-failures.js**: Vitest runner with clean failure-only reporting and stack trace filtering
- **test-coverage-summary.js**: Coverage-enabled test execution with minimal formatted output
- **test-summary.js**: Standard test execution with pass/fail statistics and error details  
- **test-results-analyzer.js**: Comprehensive JSON test result parser with multiple detail levels and performance analysis

## Public API Surface

### Primary Entry Points
- **portManager** (singleton): `getPort()`, `releasePort()`, `reset()` for test port coordination
- **processTracker** (singleton): `register()`, `cleanupAll()`, `reset()` for process lifecycle management
- **createTestDependencies()**: Complete dependency container with fake implementations
- **createMockDependencies()**: Vitest-mocked dependency container for unit tests
- **createTestSessionManager()**: SessionManager with configurable mock dependencies

### Specialized Factories
- **getDebugServer()**: Singleton DebugMcpServer for integration testing
- **createTestServer()**: DebugMcpServer with test-safe configuration
- **createMockProxyManager()**: Pre-configured proxy manager for testing
- **waitForEvent()**, **waitForCondition()**: Promise-based async test utilities

## Internal Organization and Data Flow

### Test Environment Setup
1. **Resource Allocation**: Port manager assigns non-conflicting ports by test type
2. **Dependency Injection**: Factory functions create isolated test environments
3. **Process Tracking**: Automatic registration and cleanup of spawned processes
4. **Session Management**: Debug session creation with mock or fake implementations

### Test Execution Flow  
1. **Setup Phase**: Factories create test instances with appropriate mocks/fakes
2. **Execution Phase**: Tests run with isolated resources and tracked processes
3. **Analysis Phase**: Result parsers extract failure details and coverage metrics
4. **Cleanup Phase**: Port release, process termination, temp file removal

### Mock vs Fake Strategy
- **Mocks** (vitest spies): For unit tests requiring behavior verification
- **Fakes** (working implementations): For integration tests needing realistic behavior
- **Factories**: Support both patterns through different entry points

## Important Patterns and Conventions

### Singleton Pattern
- Port manager and process tracker use singletons for global coordination
- Debug server uses lazy singleton with proper cleanup for test isolation

### Resource Management
- Automatic cleanup on process exit via event handlers
- Defensive programming with existence checks and graceful failures
- Temporary file operations scoped to isolated test directories

### Error Handling
- Multi-layer error handling with fallback behaviors
- Process exit codes (0 success, 1 failure) for CI/CD integration
- Comprehensive logging for debugging test infrastructure issues

### Test Isolation
- Port ranges prevent conflicts between concurrent test suites
- Reset methods clear state between test runs
- Temp directories and cleanup prevent test pollution

## Dependencies
- **Node.js Built-ins**: child_process, fs, path, events for core functionality
- **Vitest**: Mock framework and test runner integration
- **@debugmcp/shared**: Type definitions and shared interfaces
- **Internal**: Production code interfaces and implementations for dependency injection