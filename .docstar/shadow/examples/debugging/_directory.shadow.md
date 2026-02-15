# examples\debugging/
@children-hash: f3401633181c05dc
@generated: 2026-02-15T09:01:24Z

## Purpose and Responsibility

The `examples/debugging` directory provides comprehensive test fixtures and validation scripts for debugging functionality within the MCP (Model Context Protocol) system. It serves as both a demonstration suite for debugging capabilities and a quality assurance framework for ensuring debugging tools work correctly across different programming languages and scenarios.

## Key Components and Organization

### Language-Specific Test Fixtures
- **`test-debug-javascript.js`**: Comprehensive JavaScript debugging scenarios including arithmetic, array processing, recursion (Fibonacci), and object manipulation
- **`test-debug-python.py`**: Python debugging test cases with list processing, function calls, and variable inspection points
- **`test-sse-fix.js`**: Minimal JavaScript debugging example focused on breakpoint testing and basic arithmetic

### Integration Testing
- **`test-sse-js-debug-fix.js`**: Critical integration test that validates the fix for SSE (Server-Sent Events) timing bugs in JavaScript debugging sessions

## Public API Surface

### Test Script Entry Points
- **JavaScript Tests**: Direct Node.js execution with comprehensive console logging for trace visibility
- **Python Tests**: Standalone Python script execution with enumerated debugging output
- **Integration Tests**: Automated test runner that manages complete debugging session lifecycle

### Debugging Scenarios Provided
- **Basic Operations**: Arithmetic calculations with step-through capabilities
- **Data Structure Processing**: Array/list iteration with index tracking
- **Control Flow**: Recursive function calls for call stack analysis
- **Variable Inspection**: Multiple data types (primitives, arrays, objects) for variable examination
- **Timing Validation**: Critical timing tests for debugging session readiness

## Internal Organization and Data Flow

### Test Execution Pattern
1. **Setup Phase**: Variable initialization and test data preparation
2. **Execution Phase**: Step-by-step operations with extensive logging
3. **Aggregation Phase**: Result combination and final output
4. **Validation Phase**: Return value propagation and verification

### Integration Test Architecture
1. **Server Lifecycle Management**: Spawns and manages SSE server processes
2. **MCP Client Setup**: Establishes transport connections with proper identity
3. **Debug Session Creation**: Creates and configures debugging sessions
4. **Critical Timing Tests**: Validates that debugging operations work immediately after session creation
5. **Cleanup Strategy**: Guaranteed resource cleanup with graceful shutdown

## Important Patterns and Conventions

### Debugging-Friendly Design
- Extensive console.log/print statements at key execution points
- Clear variable naming conventions for easy inspection
- Explicit breakpoint guidance through comments
- Predictable execution flow suitable for step-through debugging

### Error Handling and Resilience
- Comprehensive try-catch blocks with guaranteed cleanup
- Port availability checking with retry mechanisms
- Graceful degradation and error reporting
- Timeout handling for external process management

### Testing Consistency
- Fixed port assignments (3100) for reliable testing
- Standardized file paths and naming conventions
- Consistent error handling patterns across languages
- Uniform logging and output formatting

## Role in Larger System

This directory serves as the validation layer for MCP debugging capabilities, ensuring that:
- Debugging sessions can be created and managed correctly
- Breakpoints function properly across different languages
- Stack traces and variable inspection work reliably
- Timing-sensitive operations (like immediate post-session debugging calls) function correctly
- The debugging infrastructure remains stable across different execution environments

The examples provide both reference implementations for debugging integrations and regression tests for maintaining debugging functionality quality.