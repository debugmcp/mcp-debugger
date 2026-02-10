# tests/test-utils/fixtures/
@generated: 2026-02-10T21:26:29Z

## Test Fixtures for Debugger and Python Process Testing

This directory provides comprehensive test fixtures for validating debugger functionality, process monitoring, and MCP (Model Context Protocol) server debugging capabilities. It contains both TypeScript-defined Python script templates and actual Python executables designed to support automated testing of debugging workflows.

### Overall Purpose

The fixtures enable testing of:
- Python debugger features (breakpoints, stepping, variable inspection)
- Debug Adapter Protocol (DAP) server implementations
- Long-running process monitoring and attachment
- Cross-module debugging scenarios
- Exception handling and error debugging workflows
- MCP server debugging infrastructure

### Key Components

**TypeScript Script Templates (`python-scripts.ts`)**
- Collection of Python script fixtures as string templates
- Covers debugging scenarios from simple loops to complex multi-module applications
- Includes intentionally buggy code for debugging exercise testing
- Provides self-contained scripts with meaningful test data

**Python Debug Targets (`python/` directory)**
- `debug_test_simple.py`: Basic long-running process for external debugger attachment
- `debugpy_server.py`: Full DAP debug server implementation with configurable test scenarios

### Public API Surface

**Entry Points:**
- **TypeScript Exports**: `simpleLoopScript`, `functionCallScript`, `fibonacciScript`, `exceptionHandlingScript`, `multiModuleMainScript`, `multiModuleHelperScript`, `buggyScript`
- **Python Executables**: Direct script execution for `debug_test_simple.py`, CLI-driven `debugpy_server.py` with server/test modes

**Key Capabilities:**
- Progressive complexity testing (loops → functions → recursion → exceptions → modules)
- Real-time debugging server with breakpoint scenarios
- Extended execution windows for external tool integration
- Configurable debug server (host/port customization, client connection handling)

### Internal Organization and Data Flow

**Testing Workflow:**
1. **Template-based Testing**: TypeScript exports provide Python code strings for dynamic test generation
2. **Live Process Testing**: Python executables offer real debugging targets with predictable behavior
3. **Multi-layer Coverage**: From simple computation flows to complex multi-module debugging scenarios

**Integration Patterns:**
- TypeScript fixtures support automated test generation and execution
- Python executables enable manual and automated debugger attachment testing
- Both layers provide controlled, predictable environments for validation
- Proper debugpy server architecture (server listens, clients connect as DAP clients)

### Important Conventions

**Fixture Design:**
- Self-contained scripts with `if __name__ == "__main__"` guards
- Meaningful test data and predictable execution flows
- Extended timing windows for external tool attachment
- Progressive complexity from basic loops to advanced debugging scenarios
- Intentional bugs and error conditions for comprehensive testing

This fixture collection provides a complete testing foundation for Python debugging infrastructure, supporting both unit testing of debugger features and integration testing of debugging workflows in MCP environments.