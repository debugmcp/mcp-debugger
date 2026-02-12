# tests\test-utils\helpers/
@generated: 2026-02-12T21:05:51Z

## Purpose
Test helper utilities directory providing comprehensive infrastructure for the Debug MCP Server test suite. Contains specialized utilities for resource management, process tracking, test setup, and result analysis to ensure reliable, isolated test execution across unit, integration, and E2E test scenarios.

## Core Components & Organization

### Resource Management
- **PortManager** (`port-manager.ts`): Centralized port allocation system preventing conflicts between concurrent test runs. Uses range-based allocation (Unit: 5679-5779, Integration: 5779-5879, E2E: 5879-5979) with singleton pattern for global coordination.
- **ProcessTracker** (`process-tracker.js/.d.ts`): Manages spawned child processes during test execution to prevent orphaned processes. Provides graceful termination with SIGTERM→SIGKILL fallback and comprehensive cleanup mechanisms.

### Test Environment Setup
- **TestDependencies** (`test-dependencies.ts`): Factory functions for creating isolated test environments with mock/fake implementations. Provides complete dependency injection containers avoiding production code contamination.
- **TestSetup** (`test-setup.ts`): Specialized factories for SessionManager and related components with configurable mock dependencies and lifecycle simulation utilities.
- **TestUtils** (`test-utils.ts`): Core testing primitives including mock creation, event handling, timing utilities, and temporary file management.

### Debugging & Session Support
- **SessionHelpers** (`session-helpers.ts`): Wrapper utilities around DebugMcpServer for debugging operations during integration testing. Provides lazy singleton pattern with proper cleanup for test isolation.

### Test Execution & Analysis
- **Coverage Summary** (`test-coverage-summary.js`): CLI script for executing tests with coverage reporting and minimal formatted output display.
- **Test Summary** (`test-summary.js`): Vitest execution wrapper providing clean, formatted test result summaries for CI/CD environments.
- **Results Analyzer** (`test-results-analyzer.js`): JSON test result parser with multiple analysis levels (summary, failures, detailed) and performance metrics.
- **Show Failures** (`show-failures.js`): Focused failure reporting utility that filters verbose output to display only test failures in readable format.

## Public API Surface

### Primary Entry Points
- `portManager` (singleton): Global port allocation for test isolation
- `processTracker` (singleton): Process lifecycle management  
- `createTestDependencies()`: Complete dependency container factory
- `createTestSessionManager()`: SessionManager with mock dependencies
- `createMockDependencies()`: Vitest spy-based mock container

### Utility Functions
- `waitForCondition()`, `waitForEvent()`: Async testing helpers
- `createTempTestFile()`, `cleanupTempTestFiles()`: File system test utilities
- `getDebugServer()`, `cleanupTestServer()`: Debug session management
- CLI scripts: `test-coverage-summary.js`, `test-summary.js`, `show-failures.js`

## Internal Architecture

### Data Flow Patterns
1. **Resource Allocation**: PortManager assigns ports → ProcessTracker monitors spawned processes → cleanup on test completion
2. **Test Setup**: Factory functions create isolated environments → dependency injection → mock configuration → test execution
3. **Result Processing**: Test runners capture JSON output → parsers extract metrics → formatters display results

### Key Design Patterns
- **Singleton Pattern**: PortManager and ProcessTracker ensure global state consistency
- **Factory Pattern**: Multiple factory functions for different testing scenarios (fake vs mock implementations)
- **Dependency Injection**: Complete separation of test dependencies from production code
- **Lazy Initialization**: Debug servers and resources created on-demand
- **Defensive Programming**: Comprehensive error handling and cleanup in all utilities

## Integration Points
- **Vitest Integration**: Custom reporters, JSON output parsing, coverage analysis
- **Debug Protocol**: VSCode DAP integration through DebugMcpServer wrappers  
- **Process Management**: Node.js child_process integration with cleanup tracking
- **File System**: Temporary file creation in isolated test directories
- **Network**: Port allocation coordination across test categories

## Critical Conventions
- All port allocations go through PortManager to prevent conflicts
- Process spawning must register with ProcessTracker for cleanup
- Factory functions return both instances and dependencies for test introspection
- Mock objects use Vitest spies for assertion verification
- Temporary resources are automatically cleaned up on test completion
- Error handling includes both synchronous validation and async cleanup