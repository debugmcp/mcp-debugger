# examples\debugging/
@generated: 2026-02-12T21:05:45Z

## Purpose
The `examples/debugging` directory provides comprehensive test scripts and integration tests for validating MCP (Model Context Protocol) debugger functionality. This module serves as both a testing suite and demonstration collection for debugging capabilities across JavaScript and Python runtimes.

## Key Components

### Test Scripts
- **`test-debug-javascript.js`**: Comprehensive JavaScript debugging test with arithmetic operations, array processing, recursion (Fibonacci), and object manipulation. Features extensive console logging for execution tracing and multiple data types for variable inspection.

- **`test-debug-python.py`**: Python debugging test script with simple computational examples including sum calculation and list processing. Designed with deliberate print statements for debugging observation and step-through analysis.

- **`test-sse-fix.js`**: Minimal debugging example for basic arithmetic operations with explicit breakpoint placement. Serves as a simple test case for debugging workflow validation.

### Integration Tests
- **`test-sse-js-debug-fix.js`**: Critical integration test that validates the fix for a timing bug in SSE (Server-Sent Events) JavaScript debugging. Tests the specific scenario where `stackTrace` was called before the child debugging session was fully active.

## Architecture and Data Flow

### Testing Strategy
The directory implements a multi-layered testing approach:
1. **Unit-level**: Simple scripts (`test-sse-fix.js`) for basic debugging operations
2. **Feature-level**: Comprehensive scripts (`test-debug-javascript.js`, `test-debug-python.py`) covering various debugging scenarios
3. **Integration-level**: Full end-to-end tests (`test-sse-js-debug-fix.js`) validating complete debugging workflows

### Common Debugging Patterns
All test scripts follow consistent patterns:
- **Explicit logging**: Console/print statements at key execution points
- **Breakpoint-friendly design**: Clear function boundaries and predictable execution flow
- **Variable inspection support**: Named variables and structured data for debugging visibility
- **Step-through optimization**: Simple, linear execution paths suitable for debugger interaction

## Public API Surface

### Entry Points
- **JavaScript Tests**: Direct Node.js execution of `.js` files with shebang support
- **Python Tests**: Standalone Python script execution with `if __name__ == "__main__"` pattern
- **Integration Tests**: Automated test runners that spawn MCP servers and clients

### Key Testing Scenarios
- **Arithmetic Operations**: Basic calculations with tracing
- **Data Structure Processing**: Arrays, lists, and object manipulation
- **Control Flow**: Recursion, iteration, and conditional logic
- **Debugging Session Management**: Session creation, breakpoint setting, stack trace retrieval
- **Timing Validation**: Critical timing bug fixes in SSE debugging scenarios

## Internal Organization

### Language Coverage
- **JavaScript**: Node.js runtime targeting, console API usage, recursive algorithms
- **Python**: Standard library usage, enumerated iteration, functional design patterns

### Integration Testing Infrastructure
- **MCP Client Setup**: SSEClientTransport configuration and connection management
- **Server Lifecycle**: Process spawning, port availability checking, graceful cleanup
- **Error Handling**: Comprehensive try-catch patterns with guaranteed resource cleanup

## Important Patterns

### Debugging Instrumentation
- Extensive logging at function entry/exit points
- Variable state capture before/after operations
- Return value propagation for result verification
- Mixed data types for comprehensive variable inspection

### Test Isolation
- Fixed ports and file paths for consistent testing
- Process cleanup and resource management
- Error suppression during cleanup phases
- Timeout handling for port availability

The directory serves as both a validation suite for MCP debugging capabilities and a reference implementation for debugging best practices across multiple runtime environments.