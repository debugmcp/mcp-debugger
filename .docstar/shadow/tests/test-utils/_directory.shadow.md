# tests/test-utils/
@generated: 2026-02-10T21:26:50Z

## Overall Purpose
Comprehensive test utilities package for the Debug MCP Server providing infrastructure for debugging promise leaks, managing test environments, and supplying mock implementations. Enables isolated, deterministic testing across unit, integration, and end-to-end scenarios with proper resource management and cleanup.

## Key Components and Integration

### Core Test Infrastructure
- **Promise lifecycle tracking** (`promise-tracker.ts`) - Debug memory leaks by monitoring promise creation, resolution, and cleanup across test sessions
- **Session management** (`session-id-generator.ts`) - Generate unique test identifiers for resource tracking and debugging
- **Environment detection** (`python-environment.ts`) - Validate Python and debugpy availability for debugging tests

### Test Fixtures and Execution Support
- **fixtures/** - Python code templates and executables for testing debugger functionality, DAP protocol, and multi-module debugging scenarios
- **helpers/** - Process management, port allocation, dependency injection, result analysis, and test environment setup utilities
- **mocks/** - Complete mock implementations of external dependencies (child_process, DAP clients, filesystem, network) for isolated testing

## Public API Surface

### Primary Entry Points
- **Promise Debugging**: `trackPromise()`, `resolvePromise()`, `untrackPromise()`, `reportLeakedPromises()` for memory leak detection
- **Test Environment**: `getTestSessionId()`, `isPythonAvailable()`, `isDebugpyAvailable()` for test identification and validation
- **Resource Management**: `portManager.getPort()`, `processTracker.register()`, `getDebugServer()` for test isolation
- **Mock Factories**: `createMockAdapterRegistry()`, `createMockLogger()`, `MockProxyManager` for dependency simulation

### Test Fixtures
- **Python Templates**: `simpleLoopScript`, `fibonacciScript`, `exceptionHandlingScript` etc. for dynamic test generation
- **Debug Targets**: `debug_test_simple.py`, `debugpy_server.py` for live debugging testing

## Internal Organization and Data Flow

### Testing Workflow Architecture
1. **Setup Phase**: Port allocation, dependency injection, and environment validation
2. **Execution Phase**: Test execution with promise tracking, process monitoring, and resource isolation
3. **Analysis Phase**: Result parsing, leak detection, and failure analysis
4. **Cleanup Phase**: Resource cleanup, port release, and state reset

### Resource Management Strategy
- **Two-level tracking** - Global and session-scoped monitoring for flexible cleanup
- **Singleton pattern** - Port manager and process tracker coordinate globally
- **Factory pattern** - Consistent creation of test environments with mock/fake variants
- **Reset mechanisms** - Complete state cleanup for test isolation

## Integration Patterns

### Cross-Component Coordination
- Session IDs connect promise tracking with resource management
- Process tracker integrates with port manager for complete resource isolation
- Mock factories work together to simulate complete debugging environments
- Fixture templates support both automated and manual testing workflows

### Test Environment Isolation
- Port ranges prevent conflicts between concurrent test suites
- Process tracking prevents orphaned processes across test runs
- Mock implementations provide deterministic behavior without external dependencies
- Temporary file management scopes operations to isolated directories

## Important Conventions

### Test Double Strategy
- **Mocks** (vitest spies) for unit tests requiring behavior verification
- **Fakes** (working implementations) for integration tests needing realistic behavior
- **Stubs** for simple return value replacement without complex logic

### Debugging Support
- Environment variable controls (`DEBUG_PROMISE_LEAKS`) for detailed diagnostics
- Stack trace capture for precise leak source identification
- Progressive complexity testing from simple loops to multi-module debugging
- Comprehensive error simulation for negative test scenarios

## Dependencies
- **Node.js Built-ins**: child_process, fs, path, events for system integration
- **Vitest**: Test framework integration with mock and spy capabilities  
- **@debugmcp/shared**: Type definitions and shared interfaces
- **Production Code**: Interfaces for dependency injection and testing

This directory provides a complete testing foundation that enables comprehensive validation of debugger functionality while maintaining test isolation, resource cleanup, and deterministic behavior across all testing scenarios.