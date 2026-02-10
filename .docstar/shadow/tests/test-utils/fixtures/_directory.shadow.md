# tests/test-utils/fixtures/
@generated: 2026-02-09T18:16:41Z

## Overall Purpose and Responsibility
The `tests/test-utils/fixtures` directory provides comprehensive test fixtures for debugging integration tests within the MCP (Model Context Protocol) framework. It serves as a centralized repository of controlled debugging scenarios, Python script templates, and debug server infrastructure to enable thorough testing of debugging capabilities across various execution contexts.

## Key Components and Relationships

### Python Script Templates (`python-scripts.ts`)
TypeScript module exporting Python code templates as string constants, providing diverse debugging scenarios:
- **Basic Patterns**: Simple loops, function calls, and variable manipulation
- **Complex Scenarios**: Recursive algorithms (Fibonacci), exception handling, multi-module imports
- **Intentional Bugs**: Flawed implementations for debugging practice and error handling tests

### Python Debug Infrastructure (`python/` subdirectory)
Live Python processes and debug server implementations:
- **Debug Targets**: Long-running processes (`debug_test_simple.py`) for breakpoint testing
- **DAP Server**: Full Debug Adapter Protocol server (`debugpy_server.py`) with configurable networking
- **Test Payloads**: Embedded test scenarios with programmatic breakpoint placement

### Integration Architecture
The components work together to create a **multi-layered debugging test environment**:
1. **Template Layer**: TypeScript constants provide script content for dynamic test generation
2. **Process Layer**: Python fixtures provide live debugging targets with predictable behavior
3. **Protocol Layer**: DAP server infrastructure enables protocol-level debugging integration tests

## Public API Surface

### Primary Entry Points
- **`python-scripts.ts` Exports**: Named constants for script templates
  - `simpleLoopScript`, `functionCallScript`, `fibonacciScript`
  - `exceptionHandlingScript`, `multiModuleMainScript`, `multiModuleHelperScript`
  - `buggyScript` for error scenario testing
- **`debugpy_server.py` CLI**: Debug server with configurable options
  - `--host/--port`: Network binding configuration
  - `--no-wait/--run-test`: Execution mode controls
- **`debug_test_simple.py`**: Direct execution target for basic debugging scenarios

### Core Functions
- **Server Management**: `start_debugpy_server(host, port, wait_for_client)`
- **Test Execution**: `run_fibonacci_test()` with built-in breakpoints
- **Debug Targets**: `sample_function()` and other debuggable units

## Internal Organization and Data Flow

### Test Execution Pattern
1. **Setup Phase**: Test frameworks select appropriate script templates or spawn debug servers
2. **Execution Phase**: MCP processes execute templated scripts or connect to debug servers
3. **Interaction Phase**: Debugging protocols engage with breakpoints, variable inspection, stepping
4. **Validation Phase**: Test assertions verify correct debugging behavior and state

### Data Flow Architecture
```
Test Framework → Script Templates → Dynamic Python Execution
                ↓
Debug Server ← MCP Debug Client ← Debugging Protocol Integration
                ↓
Breakpoint Hits → Variable Inspection → Test Assertions
```

## Important Patterns and Conventions

### Design Principles
- **Graduated Complexity**: From simple loops to multi-module scenarios enabling progressive testing
- **Predictable Behavior**: Fixed execution times, consistent output patterns for reliable test automation
- **Self-Contained Units**: Each fixture is independent with minimal external dependencies
- **Protocol Compliance**: Full DAP compatibility for standard debugging tool integration

### Configuration Standards
- **Network Isolation**: Default localhost binding (127.0.0.1:5679) prevents external interference
- **Resource Management**: Explicit cleanup patterns and timeout controls
- **Error Resilience**: Graceful handling of missing dependencies and connection failures

### Testing Methodology
The fixtures support **comprehensive debugging scenario coverage**:
- **Stepping Behavior**: Loop iterations, function entry/exit, recursive calls
- **State Inspection**: Variable values, call stacks, module boundaries
- **Error Handling**: Exception breakpoints, error propagation, recovery scenarios
- **Multi-Context**: Single-file scripts, multi-module imports, cross-process debugging

This fixture directory enables end-to-end testing of MCP debugging capabilities by providing both static script templates for content generation and live debugging infrastructure for protocol integration testing.