# examples/debugging/
@generated: 2026-02-10T01:19:39Z

## Overall Purpose

The `examples/debugging` directory provides a comprehensive suite of debugging test scenarios and integration tests for the MCP (Model Context Protocol) debugger system. This module serves as both a demonstration of debugging capabilities and a validation framework for debugging functionality across multiple programming languages and transport protocols.

## Key Components and Relationships

### Test Scripts for Debugging Scenarios
- **test-debug-javascript.js**: Comprehensive JavaScript debugging scenarios including arithmetic, arrays, recursion (Fibonacci), and object manipulation
- **test-debug-python.py**: Python debugging examples with list processing, arithmetic operations, and enumerated iteration patterns
- **test-sse-fix.js**: Minimal JavaScript test case for basic breakpoint testing and arithmetic validation

### Integration Test Infrastructure  
- **test-sse-js-debug-fix.js**: Critical integration test that validates the fix for a timing bug in SSE (Server-Sent Events) JavaScript debugging where `stackTrace` was called before the debugging session was fully active

## Public API Surface

### Main Entry Points
1. **Individual Test Scripts**: Each test script can be executed standalone to demonstrate debugging patterns
   - JavaScript tests: Node.js execution with comprehensive logging
   - Python tests: Standard Python execution with debug tracing
2. **Integration Test Runner**: `test-sse-js-debug-fix.js` serves as a complete MCP debugging system integration test

### Key Functions Exposed
- **Arithmetic Operations**: Basic calculations with debug visibility
- **Data Structure Processing**: Array/list iteration with step-by-step logging  
- **Recursive Algorithms**: Call stack analysis through Fibonacci implementation
- **Breakpoint Testing**: Strategic breakpoint placement and validation
- **Session Management**: Debug session lifecycle testing

## Internal Organization and Data Flow

### Test Script Architecture
1. **Function Definition**: Core debugging scenarios implemented as discrete functions
2. **Orchestration**: `main()` functions coordinate test execution sequences
3. **Logging Strategy**: Extensive console output for execution tracing and variable inspection
4. **Return Value Propagation**: Clear data flow from individual operations through aggregation

### Integration Test Flow
1. **Server Lifecycle**: SSE server spawning and port availability verification
2. **MCP Client Setup**: Transport connection and client identity establishment  
3. **Debug Session Creation**: JavaScript debugging session initialization via MCP
4. **Critical Timing Test**: Immediate `get_stack_trace` calls to validate session readiness
5. **Cleanup Protocol**: Guaranteed resource cleanup with graceful shutdown

## Important Patterns and Conventions

### Debugging Visibility Patterns
- **Extensive Logging**: All scripts use heavy console/print output for execution tracing
- **Predictable Data**: Hard-coded test values ensure consistent debugging behavior
- **Clear Function Boundaries**: Discrete functions facilitate breakpoint placement
- **Variable Naming**: Explicit variable names for easy inspection

### Error Handling and Reliability
- **Comprehensive Error Handling**: Try-catch blocks with guaranteed cleanup
- **Timeout Mechanisms**: Port availability waiting with maximum attempt limits
- **Graceful Degradation**: Server termination with SIGTERM → SIGKILL fallback
- **Resource Management**: Proper cleanup of MCP clients and child processes

### Testing Strategy
- **Multi-Language Coverage**: JavaScript and Python debugging scenarios
- **Transport Protocol Testing**: SSE-based MCP communication validation
- **Timing Bug Regression**: Specific tests for session readiness timing issues
- **Standalone Execution**: Each component can run independently for isolated testing

This directory represents a complete debugging ecosystem for MCP, providing both educational examples and robust integration testing for debugging infrastructure reliability.