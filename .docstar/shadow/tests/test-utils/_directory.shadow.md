# tests\test-utils/
@generated: 2026-02-12T21:06:24Z

## Overall Purpose

The `tests/test-utils` directory provides a comprehensive testing infrastructure for the Debug MCP Server, offering specialized utilities, fixtures, helpers, and mocks that enable reliable, isolated testing across unit, integration, and end-to-end test scenarios. The module focuses on debugging workflow testing, resource management, promise leak detection, and Python environment validation.

## Key Components & Integration

### Core Testing Infrastructure
- **Session Management**: `session-id-generator.ts` creates unique test session IDs while `promise-tracker.ts` monitors promise lifecycle to detect memory leaks across test sessions
- **Environment Detection**: `python-environment.ts` validates Python runtime and debugpy module availability before executing Python debugging tests
- **Resource Coordination**: Helpers provide port allocation, process tracking, and dependency injection to prevent test conflicts and ensure proper cleanup

### Test Data & Scenarios  
- **Fixtures Directory**: Comprehensive Python debugging test cases ranging from simple loops to complex DAP server implementations, providing both static script templates and live runtime targets for debugger attachment testing
- **Mock Ecosystem**: Complete mock implementations for external dependencies (child processes, filesystem, network, DAP protocol) enabling deterministic testing without external system dependencies

### Test Execution Support
- **Helpers Directory**: Specialized utilities for test setup, resource management, result analysis, and coverage reporting with factory patterns for creating isolated test environments
- **Process & Resource Management**: Integrated tracking of spawned processes, port allocations, and temporary resources with automatic cleanup mechanisms

## Public API Surface

### Primary Entry Points
- `getTestSessionId(testName?)` - Generate unique session identifiers for test tracking
- `trackPromise()`, `resolvePromise()`, `untrackPromise()` - Promise lifecycle monitoring for leak detection  
- `isPythonAvailable()`, `isDebugpyAvailable()` - Environment prerequisite validation
- `createTestDependencies()`, `createTestSessionManager()` - Factory functions for isolated test environments
- Python fixture scripts and debugpy servers for live debugging target testing

### Resource Management APIs
- `portManager` singleton for conflict-free port allocation across test categories
- `processTracker` for spawned process lifecycle management with graceful cleanup
- `createTempTestFile()`, `cleanupTempTestFiles()` for filesystem test utilities

### Mock & Test Doubles
- Comprehensive mock ecosystem covering child processes, DAP protocol, filesystem operations, and network interactions
- Configurable failure injection and event simulation for testing error scenarios
- Call tracking and state management for test verification

## Internal Organization & Data Flow

### Layered Architecture
1. **Foundation Layer**: Environment detection and session management establish test prerequisites
2. **Resource Layer**: Port management, process tracking, and promise monitoring ensure clean test isolation  
3. **Execution Layer**: Fixtures provide test scenarios while helpers orchestrate test setup and teardown
4. **Isolation Layer**: Mocks eliminate external dependencies while maintaining realistic behavior simulation

### Integration Patterns
- **Session-Based Tracking**: Promise tracker and session IDs work together to correlate resource leaks with specific test cases
- **Environment-Driven Execution**: Python environment checks gate debugging tests to prevent spurious failures
- **Factory-Based Isolation**: Helper factories create independent test environments with controlled dependencies
- **Mock Coordination**: System mocks work together (process + DAP + filesystem) to simulate complete debugging workflows

## Critical Design Patterns

### Resource Safety
- **Automatic Cleanup**: All utilities include comprehensive cleanup mechanisms to prevent test pollution
- **Conflict Prevention**: Port allocation and process tracking prevent resource conflicts between concurrent test runs
- **Leak Detection**: Promise tracking identifies unresolved async operations that could cause test instability

### Debugging Workflow Support
- **Live Target Testing**: Python fixtures provide actual debugging targets for attachment and protocol testing
- **Protocol Simulation**: DAP mocks enable testing debug adapter communication without external debugger dependencies
- **Multi-Language Support**: Environment detection and fixtures support testing across different Python installations

### Test Framework Integration
- **Vitest Compatibility**: Extensive integration with Vitest for mocking, assertions, and test lifecycle management
- **CI/CD Support**: Result analyzers and coverage utilities provide clean output formatting for automated environments
- **Development Experience**: Debug-friendly logging and failure reporting utilities support local test development

This testing infrastructure enables comprehensive validation of Python debugging capabilities while maintaining test reliability, isolation, and developer productivity through specialized utilities tailored to debugging workflow testing requirements.