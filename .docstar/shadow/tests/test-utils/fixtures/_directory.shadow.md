# tests/test-utils/fixtures/
@generated: 2026-02-10T01:19:50Z

## Test Fixtures for Python Debugging and Process Testing

**Overall Purpose:**
This directory provides comprehensive test fixtures for validating Python debugging capabilities within the MCP ecosystem. The module contains both TypeScript-based script templates and actual Python test programs designed to support automated testing of debugger functionality, process monitoring, and debug server/client communication patterns.

**Key Components:**

**TypeScript Script Templates (`python-scripts.ts`)**
- Collection of Python script templates as string exports covering debugging scenarios from basic to complex
- Includes loops, function calls, recursion, exception handling, multi-module imports, and intentional bugs
- Serves as a source of truth for generating test Python files dynamically during test execution

**Python Debug Targets (`python/` directory)**
- `debug_test_simple.py` - Lightweight debug target for basic attachment testing with 60-second execution window
- `debugpy_server.py` - Full-featured debugpy server with configurable networking and built-in test scenarios

**Public API Surface:**

**Script Template Access:**
- `simpleLoopScript`, `functionCallScript`, `fibonacciScript` - Progressive complexity debugging scenarios
- `exceptionHandlingScript` - Error condition testing
- `multiModuleMainScript`, `multiModuleHelperScript` - Cross-module debugging
- `buggyScript` - Intentional defects for debugging practice

**Runtime Debug Targets:**
- `python debug_test_simple.py` - Basic process monitoring target
- `python debugpy_server.py [options]` - Configurable debug server (default: 127.0.0.1:5679)
- `start_debugpy_server()`, `run_fibonacci_test()` - Programmatic debugging infrastructure

**Internal Organization and Data Flow:**

The directory supports a two-tier testing approach:
1. **Template-Based Testing**: TypeScript exports provide script content for dynamic test generation and execution
2. **Direct Process Testing**: Python files serve as live debugging targets for external tool attachment

**Testing Workflow Pattern:**
- Setup: Initialize debug targets using either template-generated scripts or direct Python processes
- Connection: External MCP servers or debugging tools attach as DAP clients
- Execution: Run controlled scenarios with predictable breakpoints and variable states
- Validation: Verify debugger protocol compliance and interaction correctness

**Important Patterns and Conventions:**

**Architectural Consistency**: All fixtures follow the debugpy server pattern where test scripts act as debug servers and external tools connect as clients, maintaining proper DAP role separation.

**Progressive Complexity**: Templates are organized from simple loops to complex multi-module scenarios, supporting incremental testing of debugging features.

**Isolation and Reliability**: Each fixture is self-contained with minimal dependencies, using non-standard ports (5679) and localhost-only binding to prevent conflicts with development environments.

**Dual Format Support**: Maintains both TypeScript string templates for programmatic generation and standalone Python files for direct execution, providing flexibility for different testing architectures.