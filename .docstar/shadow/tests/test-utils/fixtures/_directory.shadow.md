# tests\test-utils\fixtures/
@generated: 2026-02-12T21:05:59Z

## Python Debugging Test Fixtures

This directory contains comprehensive Python script fixtures designed to support debugging and process testing functionality within the MCP test suite. The fixtures provide both static script templates and dynamic runtime environments for validating debugger capabilities.

### Overall Purpose

The module serves as a testing foundation for Python debugging workflows, providing fixtures that range from simple code examples to complex debugging server implementations. It enables testing of debugger attachment, breakpoint functionality, step-through debugging, exception handling, and DAP (Debug Adapter Protocol) interactions.

### Key Components

**TypeScript Script Templates (`python-scripts.ts`)**
- Collection of Python script templates as string exports
- Covers debugging scenarios from basic loops to complex multi-module programs
- Includes intentionally buggy code for debugging practice
- Provides fibonacci, exception handling, and function call test cases

**Runtime Debug Targets (`python/` directory)**
- `debug_test_simple.py`: Basic debug target with extended runtime for attachment testing
- `debugpy_server.py`: Full-featured debugpy DAP server with configurable scenarios
- Live processes that can be attached to by external debugging tools

### Public API Surface

**Static Fixtures (TypeScript exports):**
- `simpleLoopScript`: Basic iteration and variable tracking
- `functionCallScript`: Function calls and parameter passing
- `fibonacciScript`: Recursive vs iterative algorithm comparison
- `exceptionHandlingScript`: Error handling and exception breakpoints
- `multiModuleMainScript`/`multiModuleHelperScript`: Cross-module debugging
- `buggyScript`: Intentional bugs for debugging exercises

**Runtime Entry Points:**
- `debug_test_simple.py`: Direct execution for simple process attachment
- `debugpy_server.py --host <host> --port <port>`: Configurable DAP server
- `start_debugpy_server()`: Programmatic server initialization
- `run_fibonacci_test()`: Breakpoint testing scenarios

### Internal Organization

The fixtures follow a layered approach:

1. **Static Layer**: TypeScript templates provide predictable code samples for testing debugger parsing and execution control
2. **Runtime Layer**: Python processes provide live debugging targets for attachment and DAP protocol testing
3. **Complexity Progression**: From simple loops to multi-module applications to server-client interactions

### Data Flow

**Static Fixture Usage:**
Template Selection → Code Injection → Debugger Execution → Scenario Validation

**Runtime Debug Flow:**
Process Launch → Optional Debugger Attachment → Breakpoint/Step Testing → Validation

**DAP Server Flow:**
Server Initialization → Client Connection → Protocol Communication → Test Scenario Execution

### Important Patterns

- **Extended Lifetime Pattern**: Runtime fixtures use sleep mechanisms to remain available for external tool attachment
- **Self-Contained Scripts**: Each template includes proper main guards and meaningful test data
- **Configurable Behavior**: CLI-driven and programmatic configuration options
- **Error Scenarios**: Deliberate bugs and exception cases for comprehensive testing
- **Standard Protocols**: Uses DAP-compliant interfaces and non-conflicting ports (5679)

### Integration Context

This directory enables comprehensive testing of:
- MCP server debugging capabilities
- Debugger attachment to running processes
- Step-through debugging workflows
- Exception handling and error scenarios
- Multi-module and cross-file debugging
- DAP client-server communication patterns

The fixtures support both automated testing scenarios and interactive debugging validation, providing a complete foundation for testing Python debugging functionality within the MCP ecosystem.