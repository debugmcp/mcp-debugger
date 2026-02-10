# tests/test-utils/
@generated: 2026-02-10T01:20:14Z

## Test Utilities Module for Debug MCP Server

**Overall Purpose**: Comprehensive test infrastructure providing utilities, fixtures, helpers, and mocking capabilities for isolated and reliable testing of the Debug MCP Server. This module enables thorough testing of Python debugging capabilities, resource management, and protocol compliance without external dependencies or conflicts.

## Key Components and Integration

### Test Utilities Core (`/` level files)
- **Promise Leak Detection** (`promise-tracker.ts`) - Tracks promise lifecycle across test sessions to identify memory leaks and unresolved promises
- **Environment Detection** (`python-environment.ts`) - Detects Python runtime and debugpy availability for test prerequisites  
- **Session Management** (`session-id-generator.ts`) - Generates unique, traceable session IDs for resource tracking and debugging

### Test Fixtures (`fixtures/`)
Complete set of Python debugging test scenarios:
- **Script Templates** - String-based Python script templates for dynamic test generation (loops, functions, recursion, exceptions, multi-module imports)
- **Live Debug Targets** - Actual Python files serving as debugging targets (`debug_test_simple.py`, `debugpy_server.py`)
- **Progressive Complexity** - From basic debugging to complex multi-module scenarios

### Test Helpers (`helpers/`)
Comprehensive test infrastructure services:
- **Resource Management** - Port allocation (`PortManager`) and process lifecycle tracking (`ProcessTracker`)
- **Test Factories** - Complete dependency injection systems with configurable mocks
- **Debug Infrastructure** - Singleton DebugMcpServer wrapper for integration testing
- **Result Analysis** - Test execution wrappers, coverage reporting, and failure analysis tools

### Mocking System (`mocks/`)
Full mocking infrastructure for isolated testing:
- **System-Level Mocks** - Node.js APIs (child_process, fs, net, environment)
- **Protocol Mocks** - Debug Adapter Protocol client and proxy manager simulation
- **Utility Mocks** - Command finding, logging, and adapter registry mocking

## Public API Surface

### Core Test Utilities
- `trackPromise()`, `resolvePromise()`, `untrackPromise()` - Promise lifecycle management
- `getTestSessionId()`, `getTestNameFromSessionId()` - Session identification
- `isPythonAvailable()`, `isDebugpyAvailable()` - Environment validation

### Resource Management  
- `portManager` - Global port allocation singleton
- `processTracker` - Global process lifecycle management
- `createTempTestFile()`, `cleanupTempTestFiles()` - File isolation

### Test Infrastructure
- `createTestDependencies()` - Main factory for complete test environments
- `createTestSessionManager()` - SessionManager factory with mocks
- `createDebugSession()`, `setBreakpoint()`, `getVariables()` - Debug operations
- `waitForEvent()`, `waitForCondition()`, `delay()` - Timing utilities

### Mock Factories
- `createMockLogger()`, `createMockAdapterRegistry()` - Component mocking
- `childProcessMock`, `mockDapClient`, `fsExtraMock` - System-level replacements
- `setupPythonSpawnMock()` - Process simulation scenarios

## Internal Organization and Data Flow

### Layered Architecture
1. **Foundation Layer**: Core utilities for promise tracking, session management, and environment detection
2. **Infrastructure Layer**: Resource managers, test factories, and execution helpers  
3. **Simulation Layer**: Fixtures providing realistic test scenarios and debug targets
4. **Isolation Layer**: Comprehensive mocking system for external dependencies

### Resource Coordination
- **Global Coordination**: Singleton managers prevent resource conflicts across concurrent tests
- **Session-Based Tracking**: Promise and session tracking enables precise leak detection
- **Automatic Cleanup**: Process and file managers ensure clean test teardown

### Test Execution Pattern
1. **Environment Setup**: Validate Python/debugpy availability, allocate ports, create temp files
2. **Dependency Injection**: Create isolated test environments with mocks or fakes
3. **Scenario Execution**: Use fixtures and helpers for realistic debugging scenarios
4. **Resource Tracking**: Monitor promises, processes, and sessions for leaks
5. **Analysis & Cleanup**: Analyze results, report failures, and clean up resources

## Important Patterns and Conventions

### Isolation and Safety
- **Port Range Allocation**: Dedicated port ranges (5679-5979) prevent conflicts
- **Session-Based Tracking**: Unique session IDs enable precise resource attribution
- **Mock Reset Patterns**: Consistent reset methods ensure test isolation
- **Defensive Resource Management**: Automatic cleanup prevents resource leaks

### Progressive Testing Support
- **Fixture Complexity Scaling**: From simple loops to complex multi-module debugging
- **Mock Behavior Configuration**: From optimistic defaults to configurable failure modes
- **Factory Composition**: Hierarchical factories support different testing needs

### Developer Experience
- **Comprehensive Logging**: Debug modes and detailed error reporting
- **Bidirectional Utilities**: Session ID encoding/decoding for debugging
- **Analysis Tools**: Formatted test results, coverage reports, and failure analysis
- **CLI Integration**: Standalone scripts for different testing workflows

This module serves as the complete testing foundation for the Debug MCP Server, providing everything needed for reliable, isolated, and comprehensive testing of Python debugging capabilities within the MCP ecosystem.