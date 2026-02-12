# examples\debugging/
@generated: 2026-02-12T21:01:00Z

## Purpose and Responsibility

The `examples/debugging` directory provides a comprehensive testing suite for MCP (Model Context Protocol) debugger functionality. It contains test scripts and integration tests designed to validate debugging capabilities across multiple programming languages and communication protocols, with particular focus on ensuring proper timing and session management in debugging workflows.

## Key Components and Relationships

### Test Scripts for Debugging Scenarios
- **test-debug-javascript.js**: JavaScript debugging test with comprehensive scenarios including arithmetic, array processing, recursion, and object manipulation
- **test-debug-python.py**: Python debugging test with similar computational examples and extensive logging
- **test-sse-fix.js**: Minimal JavaScript breakpoint testing script for basic debugging workflows

### Integration Test Infrastructure  
- **test-sse-js-debug-fix.js**: Critical integration test validating the fix for SSE (Server-Sent Events) timing bugs in JavaScript debugging sessions

The components work together to provide a layered testing approach:
1. **Language-specific test scripts** serve as debugging targets with predictable execution flows
2. **Integration test** orchestrates complete debugging workflows using MCP client-server communication
3. **Utility functions** handle infrastructure concerns like port availability and process management

## Public API Surface

### Primary Entry Points
- **Direct Script Execution**: All test scripts can be run standalone for manual debugging
- **Integration Test**: `test-sse-js-debug-fix.js` provides automated test harness for SSE debugging functionality
- **MCP Tool Integration**: Scripts expose debugging scenarios through MCP tool calls (`debugger_create_session`, `debugger_set_breakpoint`, `get_stack_trace`, `get_local_variables`)

### Key Test Functions
- `main()` functions in language-specific scripts orchestrate debugging scenarios  
- `runTest()` in integration test manages complete test lifecycle
- `waitForPort()` utility provides infrastructure readiness checking

## Internal Organization and Data Flow

### Test Script Architecture
1. **Setup Phase**: Variable initialization and function definitions
2. **Execution Phase**: Orchestrated function calls with extensive logging
3. **Validation Phase**: Result verification and output generation

### Integration Test Flow
1. **Infrastructure Setup**: SSE server spawn and port availability verification
2. **MCP Client Connection**: Transport establishment and client initialization  
3. **Debug Session Lifecycle**: Session creation → breakpoint setup → execution → stack trace retrieval
4. **Cleanup**: Guaranteed resource cleanup with graceful shutdown

### Data Flow Patterns
- **Synchronous execution** in test scripts for predictable debugging behavior
- **Event-driven communication** in integration tests using SSE transport
- **Process orchestration** with child process management and cleanup

## Important Patterns and Conventions

### Debugging Instrumentation
- **Extensive logging**: Console.log/print statements at key execution points
- **Clear variable naming**: Explicit naming for easy debugger inspection
- **Breakpoint-friendly code**: Strategic placement of operations for step-through debugging
- **Multi-data-type scenarios**: Testing primitives, arrays, objects, and recursive calls

### Error Handling and Cleanup
- **Guaranteed cleanup**: Finally blocks ensure resource deallocation
- **Graceful degradation**: Multiple shutdown strategies (SIGTERM → SIGKILL)
- **Comprehensive error capture**: stdout/stderr logging for debugging visibility

### Test Design Principles
- **Predictable execution flows** with hard-coded values for consistent test results
- **Clear separation of concerns** between test orchestration and target functionality  
- **Cross-language consistency** in test patterns and debugging scenarios
- **Timing-sensitive validation** for ensuring proper session initialization before debugging operations

This directory serves as both a validation suite for MCP debugging functionality and a reference implementation for debugging workflow patterns across different programming languages and transport mechanisms.