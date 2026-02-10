# examples/debugging/
@generated: 2026-02-10T21:26:30Z

## Overall Purpose

The `examples/debugging` directory provides comprehensive test scripts and examples for validating MCP (Model Context Protocol) debugger functionality across different runtime environments. This module serves as both a testing suite and demonstration package for debugging capabilities in JavaScript and Python environments.

## Key Components and Relationships

### Test Scripts for Runtime-Specific Debugging
- **JavaScript Test Suite**: `test-debug-javascript.js` and `test-sse-fix.js` provide comprehensive JavaScript debugging scenarios including arithmetic operations, array processing, recursion, and object manipulation
- **Python Test Suite**: `test-debug-python.py` offers similar debugging patterns adapted for Python runtime with list processing and function orchestration
- **SSE Integration Test**: `test-sse-js-debug-fix.js` validates critical timing fixes in Server-Sent Events debugging infrastructure

### Debugging Pattern Demonstrations
All test scripts follow consistent patterns designed for debugger validation:
- Extensive logging/print statements for execution tracing
- Multiple data types (primitives, arrays/lists, objects) for variable inspection
- Clear function boundaries for breakpoint placement
- Predictable execution flows suitable for step-through debugging

## Public API Surface

### Entry Points for Testing
- **JavaScript Runtime Testing**: Execute `test-debug-javascript.js` or `test-sse-fix.js` for basic debugging validation
- **Python Runtime Testing**: Execute `test-debug-python.py` for Python-specific debugging scenarios
- **Integration Testing**: Run `test-sse-js-debug-fix.js` for comprehensive SSE debugging validation including server lifecycle management

### Key Testing Functions
- **Arithmetic Operations**: Basic calculation functions across all scripts for simple breakpoint testing
- **Data Structure Processing**: Array/list iteration with enumerated logging for complex state inspection
- **Recursive Functions**: Fibonacci implementation in JavaScript for call stack analysis
- **Object/Data Manipulation**: Result aggregation patterns for multi-variable debugging scenarios

## Internal Organization and Data Flow

### Test Execution Architecture
1. **Setup Phase**: Initialize test data and runtime environment
2. **Execution Phase**: Run computational scenarios with extensive logging
3. **Aggregation Phase**: Combine results into structured output
4. **Validation Phase**: Verify expected outcomes and debugging visibility

### SSE Integration Testing Flow
1. **Server Lifecycle**: Spawn SSE server process and wait for availability
2. **Client Setup**: Establish MCP client connection via SSEClientTransport
3. **Debug Session Management**: Create debug sessions and configure breakpoints
4. **Critical Timing Tests**: Validate stack trace availability immediately after session creation
5. **Cleanup**: Graceful shutdown of all resources with error handling

## Important Patterns and Conventions

### Debugging-Optimized Design
- **Verbose Logging**: All scripts include comprehensive console output for execution visibility
- **Predictable Control Flow**: Linear execution paths with clear function boundaries
- **Mixed Data Types**: Deliberate use of different data structures for comprehensive variable inspection
- **Hard-coded Test Values**: Consistent, predictable inputs for reliable debugging behavior

### Error Handling and Resource Management
- Comprehensive try-catch blocks with guaranteed cleanup (especially in SSE integration tests)
- Port availability checking and server lifecycle management
- Graceful degradation and error reporting for debugging tool validation

### Cross-Runtime Consistency
- Similar computational patterns implemented across JavaScript and Python for consistent debugging experience
- Parallel function structures (calculate_sum/calculateProduct, processArray/process_list) for cross-language debugging validation

This module enables comprehensive validation of MCP debugger functionality while providing clear examples of debugging-friendly code patterns for both development and testing purposes.