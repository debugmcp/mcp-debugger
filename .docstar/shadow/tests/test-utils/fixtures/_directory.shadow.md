# tests/test-utils/fixtures/
@generated: 2026-02-11T23:47:55Z

## Test Fixtures for Python Debugging and Process Testing

This directory contains comprehensive test fixtures supporting Python debugging capabilities and process monitoring within the MCP (Model Context Protocol) testing framework. The fixtures provide both TypeScript-based script templates and Python runtime targets for testing debugger functionality across different scenarios.

### Overall Purpose

The `tests/test-utils/fixtures` directory serves as a centralized repository of debugging test assets, providing:
- **Python script templates** for automated debugger testing scenarios
- **Runtime debug targets** for live debugger attachment and DAP server testing
- **Controlled test environments** with predictable execution patterns for comprehensive debugging workflow validation

### Key Components and Integration

**TypeScript Script Templates (`python-scripts.ts`)**
- Exports string-based Python script fixtures covering debugging scenarios from basic loops to complex multi-module interactions
- Provides template scripts for: simple loops, function calls, recursion (Fibonacci), exception handling, cross-module imports, and intentional bugs
- Serves as the foundation for programmatic test generation and automated debugging scenario execution

**Python Runtime Targets (`python/` subdirectory)**
- `debug_test_simple.py` - Long-running process target for external debugger attachment testing
- `debugpy_server.py` - Full DAP (Debug Adapter Protocol) server implementation for MCP server debugging workflows

### Public API Surface

**Template Access (TypeScript)**
```typescript
// Import specific debugging scenarios
import { simpleLoopScript, functionCallScript, fibonacciScript, 
         exceptionHandlingScript, multiModuleMainScript, 
         multiModuleHelperScript, buggyScript } from './python-scripts'
```

**Runtime Execution (Python)**
```bash
# Simple debug target
python debug_test_simple.py

# DAP server for MCP debugging
python debugpy_server.py [--host HOST] [--port PORT] [--no-wait]
python debugpy_server.py --run-test
```

### Internal Organization and Data Flow

The fixtures follow a two-tier architecture:

1. **Template Layer** - TypeScript module providing script content as strings for programmatic test generation
2. **Runtime Layer** - Python executables providing live processes for debugger interaction and DAP server functionality

**Integration Pattern:**
- Template scripts from `python-scripts.ts` can be written to temporary files and executed as debug targets
- Runtime targets provide immediate debug attachment points and server endpoints
- Both layers support the same debugging scenarios but at different abstraction levels

### Important Patterns and Conventions

**Progressive Complexity Model:**
- Scripts progress from basic (`simpleLoopScript`) to advanced scenarios (`multiModuleMainScript`, `buggyScript`)
- Each fixture is self-contained with proper `if __name__ == "__main__"` guards

**Extended Runtime Pattern:**
- All runtime fixtures use controlled delays (sleep mechanisms) to provide sufficient time for external debugger attachment and interaction

**DAP Architecture Compliance:**
- Proper server-client relationship where `debugpy_server.py` acts as the DAP server and MCP servers connect as debugging clients
- Configurable network binding with graceful error handling and sensible defaults

**Test Scenario Coverage:**
- Variable tracking and inspection through iterations and function calls
- Exception handling and breakpoint-on-exception scenarios
- Multi-file debugging with import resolution
- Recursive algorithm debugging with performance comparison
- Intentional bug scenarios for debugging exercise validation

This fixture collection enables comprehensive testing of Python debugging capabilities within the MCP ecosystem, supporting both automated test generation and interactive debugging scenarios.