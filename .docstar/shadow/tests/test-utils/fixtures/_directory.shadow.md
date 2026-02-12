# tests\test-utils\fixtures/
@generated: 2026-02-12T21:01:09Z

## Test Fixtures Directory for Python Debugging

**Overall Purpose**: This directory serves as a comprehensive test fixture repository for Python debugging scenarios within the MCP (Model Context Protocol) testing framework. It provides both static script templates and executable Python programs designed to test debugger functionality, Debug Adapter Protocol (DAP) integration, and MCP server debugging capabilities.

**Key Components and Relationships**:

### TypeScript Fixture Templates (`python-scripts.ts`)
- **Static Script Repository**: Collection of Python code templates as TypeScript string exports
- **Debugging Scenario Coverage**: Provides fixtures for loops, functions, recursion, exception handling, multi-module scenarios, and intentional bugs
- **Progressive Complexity**: Scripts range from simple iteration (`simpleLoopScript`) to complex recursive algorithms (`fibonacciScript`) and cross-module debugging (`multiModuleMainScript`, `multiModuleHelperScript`)

### Executable Python Fixtures (`python/` directory)
- **Runtime Debug Targets**: Live Python processes for external debugger attachment testing
- **DAP Server Implementation**: Full-featured debugpy server for sophisticated debugging protocol testing
- **Process Monitoring**: Long-running targets for testing debugger attachment and process lifecycle management

### Component Integration
The TypeScript templates and Python executables work together to provide a complete debugging test ecosystem:
- TypeScript fixtures supply code content for dynamic debugging scenarios
- Python executables provide runtime environments for actual debugger attachment
- Both support the same core debugging patterns (functions, loops, exceptions, modules)

**Public API Surface**:

### TypeScript Template Exports
- `simpleLoopScript`, `functionCallScript`, `fibonacciScript` - Core debugging patterns
- `exceptionHandlingScript` - Error scenario testing
- `multiModuleMainScript`, `multiModuleHelperScript` - Cross-module debugging
- `buggyScript` - Intentional error scenarios for debugging exercises

### Python Executable Entry Points
- **debug_test_simple.py**: Direct execution for basic 60-second attachment testing
- **debugpy_server.py**: CLI with `--host`, `--port`, `--no-wait`, `--run-test` options
- `start_debugpy_server(host, port, wait_for_client)`: Programmatic server initialization

**Internal Organization and Data Flow**:

### Test Execution Patterns
1. **Static Template Usage**: TypeScript fixtures consumed by test harnesses to generate debugging scenarios
2. **Live Target Attachment**: Python executables launched as separate processes for external debugger connection
3. **DAP Protocol Testing**: Debugpy server mode enabling MCP servers to connect as DAP clients

### Debugging Architecture
- **Correct DAP Polarity**: Python fixtures act as debug servers, external MCP servers connect as clients
- **Multi-Modal Testing**: Supports both programmatic debugging (via templates) and live attachment (via executables)
- **Scenario Isolation**: Each fixture provides distinct debugging contexts for comprehensive test coverage

**Important Conventions**:
- All Python scripts include proper `if __name__ == "__main__"` guards
- TypeScript templates are self-contained with meaningful test data
- Executable fixtures provide configurable runtime behavior
- Error handling ensures graceful degradation for test reliability
- Progressive complexity allows testing from basic to advanced debugging scenarios

This fixture directory enables comprehensive testing of Python debugging capabilities within the MCP ecosystem, supporting both automated test scenarios and interactive debugging validation.