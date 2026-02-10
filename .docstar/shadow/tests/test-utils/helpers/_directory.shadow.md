# tests/test-utils/helpers/
@generated: 2026-02-09T18:16:17Z

## Purpose
Comprehensive test utilities module providing infrastructure for testing the DebugMCP system. Contains specialized helpers for test isolation, resource management, process control, mock creation, and test execution. Designed to support unit, integration, and end-to-end testing with proper cleanup and resource lifecycle management.

## Key Components & Organization

### Resource Management
- **port-manager.ts**: Singleton port allocation system preventing conflicts across concurrent tests using range-based allocation (UNIT: 5679-5779, INTEGRATION: 5779-5879, E2E: 5879-5979)
- **process-tracker.js/.d.ts**: Global process lifecycle management preventing orphaned processes with graceful termination (SIGTERM → SIGKILL) and automatic cleanup

### Test Environment Setup
- **test-dependencies.ts**: Centralized dependency injection factory providing both fake implementations and Vitest mocks for all system interfaces (ILogger, IFileSystem, IProcessManager, etc.)
- **test-setup.ts**: Specialized factories for SessionManager and related components with configurable mock dependencies
- **session-helpers.ts**: Simplified debug session operations via singleton DebugMcpServer with comprehensive logging

### Test Execution & Analysis
- **show-failures.js**: Vitest wrapper displaying only failed tests with cleaned error output
- **test-coverage-summary.js**: Coverage-enabled test execution with minimal formatted summaries  
- **test-summary.js**: Clean test runner with structured pass/fail reporting
- **test-results-analyzer.js**: CLI tool for detailed Jest/Vitest JSON result analysis with multiple verbosity levels

### Core Testing Utilities  
- **test-utils.ts**: Foundational testing helpers including async condition waiting, event handling, mock factories, file system utilities, and proxy process simulation

## Public API Surface

### Primary Entry Points
- `portManager` - Global singleton for port allocation across test suites
- `processTracker` - Global singleton for process lifecycle management
- `createTestServer(options)` - Main DebugMcpServer factory for tests
- `createTestSessionManager(overrides, config)` - SessionManager with mocked dependencies
- `getDebugServer()` - Lazy-initialized debug server for integration tests

### Resource Management
- `portManager.getPort(range?)` / `releasePort(port)` - Port allocation/deallocation
- `processTracker.register(process, name)` / `cleanupAll()` - Process tracking and cleanup
- `cleanupTestServer()` / `cleanupTempTestFiles()` - Test teardown utilities

### Mock Creation Factories
- `createMockDependencies()` - Complete dependency container with vi.fn() mocks
- `createTestDependencies()` - Dependencies with fake implementations
- `createMockSession(overrides)` - DebugSession mocks with configurable state
- `createMockEventEmitter()` - Full EventEmitter mock with spy tracking

## Internal Organization & Data Flow

### Dependency Injection Pattern
Test dependencies flow through layered factories:
1. **Base layer**: Interface mocks (`createMockLogger`, `createMockFileSystem`)
2. **Composition layer**: Dependency containers (`createMockDependencies`)
3. **Application layer**: Configured components (`createTestSessionManager`)

### Resource Lifecycle Management
1. **Allocation**: Port manager assigns unique ports, process tracker registers spawned processes
2. **Usage**: Tests utilize allocated resources through mocked interfaces
3. **Cleanup**: Automatic cleanup via singleton cleanup methods and test teardown hooks

### Test Execution Flow
1. **Setup**: Resource allocation, dependency injection, mock configuration
2. **Execution**: Test utilities provide async waiting, event handling, condition polling
3. **Analysis**: Result parsers extract metrics from JSON outputs
4. **Teardown**: Process termination, port deallocation, temporary file cleanup

## Critical Patterns & Conventions

### Singleton Pattern
- Port manager and process tracker use singletons to maintain global state across test files
- Debug server uses lazy initialization to ensure consistent instance reuse

### Factory Pattern  
- Consistent `createTest*` and `createMock*` naming for test object creation
- Configurable overrides pattern allows selective dependency replacement

### Resource Safety
- All resource allocation includes corresponding deallocation methods
- Process tracking includes automatic cleanup on normal termination
- File system utilities create isolated temporary directories with cleanup

### Test Isolation
- Mock factories provide fresh instances to prevent test interference
- Process and port tracking enable proper cleanup between test runs
- Reset methods clear singleton state for test isolation

## Integration Points
This module serves as the foundation for all DebugMCP testing, providing standardized patterns for resource management, dependency injection, and test execution that other test files consume through imports and singleton access.