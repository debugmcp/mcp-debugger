# examples/debugging/
@generated: 2026-02-11T23:47:37Z

## Overall Purpose and Responsibility

The `examples/debugging` directory serves as a comprehensive testing and demonstration suite for MCP (Model Context Protocol) debugging capabilities. It provides concrete examples and validation tests for debugging both JavaScript and Python applications through MCP debugger integration.

## Key Components and Relationships

### Test Target Scripts
- **test-debug-javascript.js**: Comprehensive JavaScript debugging target with multiple scenarios (arithmetic, arrays, recursion, objects)
- **test-debug-python.py**: Python equivalent providing similar debugging scenarios with clear tracing
- **test-sse-fix.js**: Minimal JavaScript target for basic breakpoint testing

### Integration Test Suite
- **test-sse-js-debug-fix.js**: Critical integration test that validates the fix for a timing bug in SSE-based JavaScript debugging where `stackTrace` was called before debug sessions were fully initialized

## Public API Surface and Entry Points

### Direct Execution Scripts
- `test-debug-javascript.js` and `test-debug-python.py`: Standalone scripts that can be executed directly to provide debugging targets with extensive console output for observation
- `test-sse-fix.js`: Simple breakpoint testing target

### Integration Test Entry
- `test-sse-js-debug-fix.js`: Main validation script that:
  - Spawns MCP SSE server instances
  - Creates MCP client connections
  - Performs complete debugging workflow testing
  - Validates timing-critical operations like immediate stack trace calls

## Internal Organization and Data Flow

### Debugging Target Pattern
1. **Setup Phase**: Variable initialization and function definitions
2. **Execution Phase**: Step-through operations with extensive logging
3. **Return Phase**: Result aggregation and final output

### Integration Test Flow
1. **Server Lifecycle**: SSE server spawn → port availability wait → client connection
2. **Debug Session**: Session creation → breakpoint setup → debugging start
3. **Critical Timing Test**: Immediate stack trace/variable calls (validates timing fix)
4. **Cleanup**: Graceful client closure → server termination

## Important Patterns and Conventions

### Debugging Instrumentation
- Heavy use of console.log/print statements at operation boundaries
- Explicit variable naming for easy inspector visibility
- Clear function separation for breakpoint placement
- Mixed data types (primitives, collections, objects) for comprehensive testing

### Error Handling and Resilience
- Comprehensive try-catch blocks with guaranteed cleanup
- Graceful degradation with fallback termination strategies
- Timeout mechanisms for network operations
- Error suppression during cleanup to prevent cascade failures

### Testing Architecture
- Fixed ports (3100) and file paths for reproducible testing
- Immediate validation of critical operations (timing-sensitive calls)
- Process isolation using child_process spawning
- Both positive path testing and edge case validation

This directory represents the quality assurance foundation for MCP debugging capabilities, providing both simple targets for manual testing and automated validation of critical timing-sensitive debugging operations.