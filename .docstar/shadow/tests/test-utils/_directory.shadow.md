# tests/test-utils/
@generated: 2026-02-09T18:17:06Z

## Overall Purpose and Responsibility
The `tests/test-utils` directory provides a comprehensive test infrastructure framework for the DebugMCP system. It serves as the central testing foundation offering utilities for resource management, mock implementations, test fixtures, environment detection, and debugging test scenarios. The module enables isolated, deterministic testing across unit, integration, and end-to-end test suites while preventing resource leaks and test interference.

## Key Components and How They Relate

### Core Infrastructure Layer
- **Resource Management**: `promise-tracker.ts` and `session-id-generator.ts` provide session-based tracking and cleanup for promises and test resources, preventing memory leaks and enabling proper test isolation
- **Environment Detection**: `python-environment.ts` detects Python interpreter availability and debugpy package installation, serving as prerequisite checks for Python-based debugging tests

### Test Utilities Framework (`helpers/` subdirectory)
Comprehensive testing infrastructure providing:
- **Resource Lifecycle**: Port allocation, process tracking, and cleanup coordination across concurrent test suites
- **Dependency Injection**: Factories for creating mock dependencies, test servers, and session managers with configurable overrides
- **Test Execution**: Utilities for async condition waiting, event handling, result analysis, and specialized test runners

### Mock Infrastructure (`mocks/` subdirectory)
Complete mocking ecosystem providing:
- **System-Level Mocks**: Child process spawning, filesystem operations, network servers, and environment variables
- **Framework Component Mocks**: DAP clients, adapter registries, command finders, and proxy managers
- **Behavioral Simulation**: Realistic async behaviors, error injection, and protocol-compliant interactions

### Test Fixtures (`fixtures/` subdirectory)
Controlled debugging scenarios including:
- **Python Script Templates**: Diverse debugging scenarios from simple loops to complex multi-module scenarios
- **Live Debug Infrastructure**: Running Python processes and DAP servers for protocol integration testing
- **Graduated Complexity**: Progressive testing scenarios from basic to advanced debugging features

## Public API Surface

### Main Entry Points
- **Session Management**: `getTestSessionId()` for unique session tracking, `trackPromise()/untrackPromise()` for resource cleanup
- **Environment Checks**: `isPythonAvailable()`, `isDebugpyAvailable()` for test prerequisites
- **Resource Management**: `portManager` singleton for port allocation, `processTracker` for process lifecycle
- **Test Infrastructure**: `createTestServer()`, `createTestSessionManager()` for debug server setup
- **Mock Factories**: `createMockAdapterRegistry()`, `createMockLogger()`, comprehensive mock creation utilities

### Test Execution Tools
- **Debugging Analysis**: `reportLeakedPromises()`, `getPromiseStats()` for resource leak detection
- **Test Runners**: Specialized test execution scripts with coverage analysis and failure reporting
- **Result Analysis**: CLI tools for detailed test result parsing and reporting

## Internal Organization and Data Flow

### Resource Lifecycle Pattern
1. **Allocation**: Port manager assigns unique ports per test type (UNIT/INTEGRATION/E2E ranges), session generator creates unique identifiers
2. **Tracking**: Promise tracker and process tracker monitor active resources during test execution
3. **Cleanup**: Automatic cleanup via singleton methods and test teardown hooks prevent resource leaks

### Test Execution Architecture
```
Test Framework → Resource Allocation → Mock/Fixture Setup
                ↓
Environment Checks → Test Execution → Result Analysis
                ↓
Resource Cleanup ← Session Tracking ← Promise Monitoring
```

### Dependency Injection Flow
- **Base Layer**: Individual interface mocks (logger, filesystem, process)
- **Composition Layer**: Dependency containers with complete mock ecosystems
- **Application Layer**: Configured test servers and session managers ready for testing

## Important Patterns and Conventions

### Singleton Resource Management
- Global port manager and process tracker ensure no resource conflicts across concurrent tests
- Session-based promise tracking enables bulk cleanup and leak detection
- Lazy-initialized debug servers provide consistent instance reuse

### Factory Pattern Consistency
- Uniform `createTest*` and `createMock*` naming conventions
- Configurable override patterns for selective dependency replacement
- Reset methods on all mocks for proper test isolation

### Multi-Layer Testing Support
- **Unit Tests**: Comprehensive mocks with no external dependencies
- **Integration Tests**: Live fixtures with controlled debugging scenarios  
- **End-to-End Tests**: Full protocol simulation with realistic behaviors

### Debugging-Focused Design
The entire infrastructure is specifically designed for testing debugging workflows:
- DAP protocol simulation and compliance testing
- Python environment detection and script template execution
- Breakpoint placement, variable inspection, and stepping behavior validation
- Multi-process debugging scenario support

This directory serves as the foundational testing infrastructure that enables reliable, fast, and comprehensive testing of the entire DebugMCP framework while maintaining proper resource management and test isolation.