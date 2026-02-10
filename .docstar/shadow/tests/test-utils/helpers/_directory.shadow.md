# tests/test-utils/helpers/
@generated: 2026-02-10T01:19:47Z

## Purpose
Test helper utilities module providing comprehensive support for isolated testing of the Debug MCP Server. Contains specialized utilities for process management, port allocation, session debugging, result analysis, and mock object creation to ensure reliable test execution without conflicts or resource leaks.

## Key Components and Organization

### Resource Management
- **PortManager** (`port-manager.ts`) - Centralized port allocation with range-based assignment (unit/integration/e2e tests) to prevent port conflicts between concurrent test runs
- **ProcessTracker** (`process-tracker.js/.d.ts`) - Global process lifecycle management with auto-cleanup to prevent orphaned child processes during test execution

### Test Infrastructure  
- **TestDependencies** (`test-dependencies.ts`) - Factory functions for creating complete dependency containers with either fake implementations or vitest mocks
- **TestSetup** (`test-setup.ts`) - Specialized factories for SessionManager and related components with configurable mock dependencies
- **TestUtils** (`test-utils.ts`) - Core utilities for mock creation, event handling, timing, and proxy process testing

### Debugging Support
- **SessionHelpers** (`session-helpers.ts`) - Singleton DebugMcpServer wrapper with debugging operations (breakpoints, variables, stack traces) for integration testing

### Test Execution and Analysis
- **TestSummary** (`test-summary.js`) - Vitest execution wrapper with clean, formatted result output for CI/CD environments
- **TestCoverageSummary** (`test-coverage-summary.js`) - Coverage-enabled test runner with minimal summary reporting
- **TestResultsAnalyzer** (`test-results-analyzer.js`) - Multi-level JSON result parsing with failure analysis and performance metrics
- **ShowFailures** (`show-failures.js`) - Focused failure reporting utility that filters verbose output to show only test failures

## Public API Surface

### Entry Points
- `portManager` - Singleton for port allocation across test types
- `processTracker` - Singleton for process lifecycle management  
- `createTestDependencies()` - Main factory for complete test environments
- `createTestSessionManager()` - Primary SessionManager factory with mocks
- Debug session helpers: `createDebugSession()`, `setBreakpoint()`, `getVariables()`, etc.

### Core Utilities
- Event handling: `waitForEvent()`, `waitForCondition()`, `waitForEvents()`
- Mock creation: `createMockSession()`, `createMockLogger()`, `createMockFileSystem()`
- File operations: `createTempTestFile()`, `cleanupTempTestFiles()`
- Timing: `delay()`, `withTimeout()`

## Internal Organization and Data Flow

### Dependency Injection Pattern
Test factories create complete dependency containers with either:
1. **Fake implementations** - Functional test doubles from `tests/implementations/test/`
2. **Vitest mocks** - Spy functions for behavior verification

### Resource Coordination
- PortManager allocates from dedicated ranges (5679-5979) with fallback logic
- ProcessTracker maintains global registry with auto-cleanup on process exit
- Temporary files isolated under OS temp directory with structured cleanup

### Test Execution Flow
1. **Setup**: Factories create isolated environments with controlled dependencies
2. **Execution**: Resource managers prevent conflicts and track allocations  
3. **Analysis**: Result analyzers parse outputs and provide formatted summaries
4. **Cleanup**: Automatic resource deallocation and process termination

## Important Patterns and Conventions

### Singleton Management
- PortManager and ProcessTracker use singleton pattern for global coordination
- SessionHelpers provides lazy-initialized DebugMcpServer singleton
- All singletons support reset() for test isolation

### Factory Composition
- Hierarchical factory system: base dependencies → specialized components → complete systems
- Override pattern: merge custom configuration with sensible defaults
- Type-safe mock creation with interface compliance

### Error Handling
- Defensive programming with file existence checks and JSON parsing validation
- Graceful degradation in resource allocation with fallback strategies
- Comprehensive logging for debugging test infrastructure issues

### CLI Integration
- Multiple standalone scripts for different testing workflows
- Consistent JSON output parsing across analysis tools
- Process exit codes for CI/CD integration

This module serves as the foundation for reliable, isolated testing of the Debug MCP Server by providing coordinated resource management, comprehensive mocking capabilities, and analysis tools for test results.