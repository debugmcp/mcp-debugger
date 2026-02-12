# tests\fixtures\python/
@generated: 2026-02-12T21:05:43Z

## Purpose

This directory contains test fixtures specifically designed for validating debugging workflow functionality in the MCP (Model Context Protocol) Server. It provides both client-side test targets and server-side debugging infrastructure needed to comprehensively test debugger integration capabilities.

## Key Components

### Debug Target (`debug_test_simple.py`)
- **Simple Python script** serving as a predictable debugging target
- Contains strategically placed breakpoint locations and variable inspection opportunities
- Implements both synchronous computation and timed operations for comprehensive debugging scenarios
- Designed with minimal dependencies and clear execution flow for reliable test outcomes

### Debug Server (`debugpy_server.py`) 
- **Mock debugpy server** implementing DAP (Debug Adapter Protocol) for testing server connections
- Provides basic DAP command handling (initialize, launch, threads, disconnect) without actual debugging functionality
- Uses standard debugpy port (5678) and protocol conventions for realistic testing environment

## Integration & Data Flow

The fixtures work together to create a complete debugging test environment:

1. **`debugpy_server.py`** acts as the debugging backend, accepting DAP connections and responding to protocol commands
2. **`debug_test_simple.py`** serves as the debugging target, providing a controlled script with known breakpoint locations and variable states
3. Test harnesses can launch both components to validate end-to-end debugging workflows

## Public API Surface

### Debug Target Entry Points
- `sample_function()`: Primary function containing breakpoint targets and variable inspection points
- `main()`: Orchestrates test execution with clear start/completion signaling
- **Line 13**: Documented breakpoint location for consistent test targeting

### Debug Server Entry Points
- `main()`: Server startup with configurable port and wait behavior
- **DAP Protocol**: Standard debugging protocol interface on localhost:5678
- **Signal handling**: Graceful shutdown capability for test cleanup

## Architectural Patterns

- **Minimal Dependencies**: Both fixtures use standard library only to reduce test environment complexity
- **Protocol Compliance**: Server implements proper DAP message framing and response structures
- **Predictable Execution**: Debug target designed for deterministic behavior across test runs
- **Isolation**: Each fixture can operate independently while supporting integrated testing scenarios

## Testing Conventions

- Clear separation between debugging infrastructure (server) and debugging targets (client scripts)
- Standardized breakpoint locations and variable naming for consistent test assertions
- Support for both automated and interactive debugging test scenarios
- Graceful cleanup mechanisms for reliable test suite integration