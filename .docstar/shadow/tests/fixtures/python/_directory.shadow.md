# tests/fixtures/python/
@generated: 2026-02-10T01:19:39Z

## Purpose and Responsibility

The `tests/fixtures/python` directory provides test fixtures specifically designed to support debugging workflow validation. This module contains both debuggable Python scripts and debug protocol infrastructure needed to test MCP Server debugpy integration and debugging capabilities.

## Key Components and Relationships

### Test Target (`debug_test_simple.py`)
- **Debuggable Python Script**: Simple, predictable execution flow designed for debugger testing
- **Breakpoint Targets**: Strategic line placements (L13) for breakpoint validation
- **Variable Inspection Support**: Multiple local variables at different scopes for testing variable inspection functionality
- **Execution Patterns**: Both synchronous computation and timed operations for comprehensive debugging scenarios

### Debug Protocol Infrastructure (`debugpy_server.py`)
- **DAP Server Simulation**: Minimal Debug Adapter Protocol server for testing debugpy connections
- **Protocol Compliance**: Implements standard DAP message framing and basic command handling
- **Connection Testing**: Provides realistic debugging protocol interaction without full debugpy complexity

## Public API and Entry Points

### Primary Test Execution
- `debug_test_simple.py`: Standalone executable via `if __name__ == "__main__"` pattern
  - Entry point: `main()` function
  - Core test logic: `sample_function()` with documented breakpoint locations

### Debug Server Simulation
- `debugpy_server.py`: Command-line debug server
  - Entry point: `main()` with argument parsing
  - Default configuration: localhost:5678 (standard debugpy port)
  - Supports `--no-wait` compatibility flag

## Internal Organization and Data Flow

### Test Script Architecture
1. **Setup Phase**: Variable initialization and function calls
2. **Computation Phase**: Strategic calculations with breakpoint opportunities
3. **Iteration Phase**: Timed loops for step debugging scenarios
4. **Output Verification**: Clear result printing for test validation

### Debug Protocol Flow
1. **Connection Establishment**: Socket-based server listening
2. **Message Processing**: DAP header parsing and JSON payload extraction
3. **Command Handling**: Basic DAP commands (initialize, launch, threads, disconnect)
4. **Response Generation**: Proper DAP-compliant message formatting

## Important Patterns and Conventions

### Testing Patterns
- **Minimal Dependencies**: Both fixtures use only standard library components
- **Clear Execution Flow**: Linear, predictable execution paths for reliable testing
- **Strategic Instrumentation**: Explicit breakpoint locations and variable placements
- **Graceful Termination**: Signal handling and clean shutdown procedures

### Protocol Compliance
- **DAP Standards**: Proper Content-Length headers and JSON message formatting
- **Capability Negotiation**: Standard debugpy protocol handshake implementation
- **Mock Responses**: Realistic but simplified responses for testing purposes

### Integration Considerations
- **Port Standardization**: Uses conventional debugpy port (5678) for realistic testing
- **Localhost Binding**: Security-conscious local-only access
- **Synchronous Design**: Simplified threading model for predictable test behavior

This fixture directory enables comprehensive testing of debugging workflows by providing both the target code to be debugged and the infrastructure to simulate debugging protocol interactions.