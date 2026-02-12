# tests/test-utils/helpers/
@generated: 2026-02-11T23:47:49Z

## Purpose
Test helper utilities module providing comprehensive test infrastructure for the Debug MCP Server. This directory contains specialized utilities for resource management, process lifecycle control, debugging session testing, test result analysis, and mock object creation. Serves as the foundation for isolated, reliable testing across unit, integration, and end-to-end test suites.

## Key Components and Organization

### Resource Management
- **PortManager** (`port-manager.ts`): Centralized port allocation system preventing conflicts between concurrent tests. Uses range-based allocation (Unit: 5679-5779, Integration: 5779-5879, E2E: 5879-5979) with fallback logic and singleton pattern for global coordination.

- **ProcessTracker** (`process-tracker.js/.d.ts`): Global process lifecycle manager that tracks spawned child processes and provides cleanup mechanisms. Prevents orphaned processes through auto-registration, graceful termination (SIGTERM → SIGKILL), and bulk cleanup operations.

### Test Environment Setup
- **TestDependencies** (`test-dependencies.ts`): Factory functions for creating isolated test environments with complete dependency injection. Provides both fake implementations and vitest mocks for all core interfaces, ensuring test isolation and avoiding production code contamination.

- **TestSetup** (`test-setup.ts`): Specialized factories for SessionManager and related components. Primary entry point for creating configured test instances with mock dependencies and lifecycle simulation utilities.

- **TestUtils** (`test-utils.ts`): Core testing primitives including mock object creators, event handling helpers, timing utilities, temporary file management, and proxy testing framework.

### Debugging and Session Testing
- **SessionHelpers** (`session-helpers.ts`): Debugging session test utilities providing singleton DebugMcpServer instance and wrapper functions for session operations, breakpoint management, and debug control flow. Includes proper cleanup for test isolation.

### Test Analysis and Reporting
- **TestSummary** (`test-summary.js`): Vitest integration utility for clean test result reporting in CI/CD environments. Executes tests, parses JSON output, and displays formatted pass/fail summaries.

- **TestResultsAnalyzer** (`test-results-analyzer.js`): Comprehensive test result analysis with multiple detail levels (summary, failures, detailed). Provides CLI interface and formatted output with performance metrics and error filtering.

- **ShowFailures** (`show-failures.js`): Focused failure reporting utility that filters verbose output to display only test failures with clean formatting.

- **TestCoverageSummary** (`test-coverage-summary.js`): Combined test execution and coverage reporting with minimal output formatting.

## Public API Surface

### Main Entry Points
- `portManager` - Global singleton for port allocation across test suites
- `processTracker` - Global process lifecycle manager
- `createTestDependencies()` - Primary factory for complete test environments
- `createTestSessionManager()` - SessionManager factory with configurable mocks
- Session debugging helpers: `createDebugSession()`, `setBreakpoint()`, `continueExecution()`
- Test utilities: `waitForCondition()`, `waitForEvent()`, `createMockSession()`

### CLI Tools
- `test-summary.js` - Test execution with formatted output
- `test-results-analyzer.js` - Multi-level result analysis
- `show-failures.js` - Failure-focused reporting
- `test-coverage-summary.js` - Coverage reporting

## Internal Organization and Data Flow

### Resource Coordination
1. **Port Management**: Tests request ports from centralized manager → range-based allocation → fallback to global search → cleanup on test completion
2. **Process Tracking**: Process spawning → auto-registration → lifecycle monitoring → graceful cleanup on exit

### Test Environment Setup
1. **Dependency Injection**: Factory functions → mock/fake implementations → complete dependency containers → test isolation
2. **Session Testing**: Debug server setup → session creation → debugging operations → cleanup

### Result Processing
Test execution → JSON output capture → parsing → formatting → display/reporting

## Important Patterns and Conventions

### Singleton Pattern
- PortManager and ProcessTracker use module-level singletons for global state coordination
- SessionHelpers provides lazy-initialized singleton DebugMcpServer

### Factory Pattern
- Multiple factory functions for different testing scenarios (fakes vs mocks)
- Configurable overrides with sensible defaults
- Complete dependency container creation

### Resource Cleanup
- Automatic cleanup mechanisms in process tracking and port management
- Temporary file management with isolated test directories
- Event listener cleanup to prevent memory leaks

### Error Handling
- Defensive programming with existence checks and fallback values
- Graceful degradation in result parsing and display
- Comprehensive error boundaries in CLI utilities

### Test Isolation
- Port range segregation by test type
- Fresh mock instances per test
- Temporary file scoping
- Process lifecycle boundaries

This module serves as the comprehensive testing foundation, providing infrastructure for reliable, isolated, and well-instrumented test execution across the entire Debug MCP Server codebase.