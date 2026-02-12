# tests/test-utils/
@generated: 2026-02-11T23:48:18Z

## Test Utilities Infrastructure for Debug MCP Server

**Overall Purpose**: Comprehensive testing infrastructure providing specialized utilities, fixtures, helpers, and mocks for testing the Debug MCP (Model Context Protocol) Server. This module enables isolated, reliable testing across unit, integration, and end-to-end test suites by providing resource management, debugging session testing, Python environment simulation, and complete mock ecosystems.

## Key Components and Integration

### Core Testing Infrastructure
- **Resource Management**: Global port allocation (`PortManager`) and process lifecycle tracking (`ProcessTracker`) prevent conflicts between concurrent tests and ensure cleanup
- **Session Testing**: Debugging session utilities with singleton DebugMcpServer instances and comprehensive debugging workflow testing capabilities
- **Environment Detection**: Python runtime and debugpy availability checking for cross-platform test execution

### Test Fixtures and Templates
- **Python Script Templates**: String-based Python fixtures for automated debugging scenario generation (loops, recursion, exceptions, multi-module)
- **Runtime Debug Targets**: Live Python processes for external debugger attachment and DAP server testing
- **Progressive Complexity Model**: Fixtures range from basic scenarios to complex multi-file debugging with intentional bugs

### Mock Ecosystem
- **System-Level Mocks**: Complete Node.js module replacement (child_process, net, fs-extra) with deterministic behavior
- **Debug Protocol Mocks**: Full DAP client/server simulation with event-driven architecture
- **Process Management Mocks**: Proxy manager and adapter registry mocking for multi-process debugging scenarios

### Test Analysis and Reporting
- **Result Processing**: Multiple CLI tools for test execution, failure analysis, coverage reporting, and formatted output
- **Performance Monitoring**: Promise leak detection and test execution statistics

## Public API Surface

### Main Entry Points
```typescript
// Resource Management
import { portManager, processTracker } from './helpers'

// Test Environment Setup
import { createTestDependencies, createTestSessionManager } from './helpers'

// Session Testing
import { createDebugSession, setBreakpoint, continueExecution } from './helpers'

// Environment Detection  
import { isPythonAvailable, isDebugpyAvailable } from './python-environment'

// Session Identification
import { getTestSessionId, getTestNameFromSessionId } from './session-id-generator'

// Promise Leak Detection
import { trackPromise, resolvePromise, reportLeakedPromises } from './promise-tracker'

// Python Fixtures
import { simpleLoopScript, fibonacciScript, multiModuleMainScript } from './fixtures'

// Mock Infrastructure
import { createMockAdapterRegistry, createMockLogger, mockDapClient } from './mocks'
```

### CLI Tools
- `test-summary.js` - Clean test execution with formatted results
- `test-results-analyzer.js` - Multi-level failure analysis
- `show-failures.js` - Focused failure reporting
- `test-coverage-summary.js` - Combined test and coverage execution

## Internal Organization and Data Flow

### Test Lifecycle Management
1. **Setup Phase**: Port allocation, process tracking, mock configuration, and environment detection
2. **Execution Phase**: Test running with session management, debugging operations, and promise tracking
3. **Verification Phase**: Result analysis, leak detection, and mock call verification  
4. **Cleanup Phase**: Resource deallocation, process termination, and state reset

### Cross-Component Integration
- **Resource Coordination**: Port manager and process tracker provide conflict-free resource allocation across test types (unit: 5679-5779, integration: 5779-5879, e2e: 5879-5979)
- **Mock Ecosystem**: System mocks integrate with DAP protocol mocks and debug adapter mocks for comprehensive testing scenarios
- **Fixture Pipeline**: Python script templates can be written to temporary files and executed as debug targets using runtime fixtures
- **Session Tracking**: Unique session IDs enable correlation between promise leaks, debug sessions, and test execution context

## Important Patterns and Conventions

### Testing Architecture Principles
- **Complete Isolation**: Each test gets fresh mocks, isolated ports, separate processes, and unique session identifiers
- **Deterministic Behavior**: Mocks use `process.nextTick()` timing and controlled responses for predictable test execution
- **Progressive Complexity**: Test fixtures and scenarios build from simple to complex debugging workflows
- **Defensive Programming**: Graceful fallbacks, existence checks, and comprehensive error handling throughout

### Resource Management Strategy
- **Singleton Coordination**: Global managers prevent resource conflicts while maintaining test isolation
- **Range-Based Allocation**: Different test types get dedicated port ranges with fallback mechanisms
- **Automatic Cleanup**: Process tracking, temporary file management, and mock state reset ensure clean test boundaries

### Mock Design Patterns
- **Factory Pattern**: Configurable mock creation for scenario-specific testing with sensible defaults
- **Event-Driven Simulation**: Realistic async behavior through EventEmitter patterns
- **Call Tracking**: Complete method invocation history for test verification
- **Type Safety**: Full TypeScript interface compliance with original system modules

This infrastructure enables comprehensive testing of the Debug MCP Server's complex interactions with Python processes, debug protocols, network communication, and filesystem operations while maintaining complete test isolation and reliable execution across different environments.