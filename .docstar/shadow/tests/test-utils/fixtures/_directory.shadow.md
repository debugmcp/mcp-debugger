# tests\test-utils\fixtures/
@children-hash: 0caed388f7c91bf5
@generated: 2026-02-15T09:01:38Z

## Test Fixtures Directory for Debugging Infrastructure

This directory provides comprehensive test fixtures for validating Python debugging capabilities, containing both script templates and executable test targets for different debugging scenarios.

### Overall Purpose
Serves as a centralized fixture collection for testing Python debugging infrastructure, supporting:
- Debug Adapter Protocol (DAP) client-server interactions
- Debugger attachment to running processes  
- Multi-module debugging workflows
- Exception handling and breakpoint testing
- MCP (Model Context Protocol) server debugging validation

### Key Components and Architecture

**Script Templates (python-scripts.ts)**
TypeScript module exporting Python code as string templates for automated test generation:
- `simpleLoopScript` - Basic iteration and variable tracking
- `functionCallScript` - Function stepping and parameter inspection
- `fibonacciScript` - Recursive vs iterative algorithm debugging
- `exceptionHandlingScript` - Error condition and try/catch testing
- `multiModuleMainScript` + `multiModuleHelperScript` - Cross-module debugging
- `buggyScript` - Intentional bugs for debugging exercise scenarios

**Executable Test Targets (python/)**
Live Python programs for runtime debugging attachment:
- `debug_test_simple.py` - Long-running process (60s sleep) for basic attachment testing
- `debugpy_server.py` - Full DAP server with configurable scenarios and CLI interface

### Public API Surface

**Template Access:**
```typescript
import { simpleLoopScript, functionCallScript, fibonacciScript, /* ... */ } from './python-scripts'
```

**Runtime Debugging:**
```bash
# Basic attachment target
python debug_test_simple.py

# Configurable DAP server
python debugpy_server.py [--host HOST] [--port PORT] [--no-wait] [--run-test]
```

**Key Server Functions:**
- `start_debugpy_server(host, port, wait_for_client)` - DAP server initialization
- `run_fibonacci_test()` - Predefined debugging scenario with breakpoints

### Internal Organization and Data Flow

**Template-Based Testing:**
1. TypeScript fixtures generate Python code strings
2. Test frameworks execute generated scripts with debugger attachment
3. Validates specific debugging features (stepping, breakpoints, variable inspection)

**Runtime Testing:**
1. Target processes start and enter predictable execution states
2. External debuggers/MCP servers attach as DAP clients
3. Interactive or automated debugging scenarios execute
4. Validation occurs through DAP protocol interactions

### Important Patterns and Conventions

**Test Design Principles:**
- **Predictable Execution**: All fixtures have deterministic flow for reliable breakpoint placement
- **Progressive Complexity**: From simple loops to multi-module recursive scenarios
- **Self-Contained**: Each fixture includes proper `__main__` guards and meaningful test data
- **Extended Runtime**: Long-running processes provide sufficient time for manual debugging

**Debugging Architecture:**
- Follows standard debugpy server pattern (not client mode)
- Uses non-conflicting port (5679) for isolation from development debugging
- Supports both automated test harnesses and manual debugging sessions
- Handles graceful error conditions and dependency validation

**Integration Model:**
The directory supports two complementary testing approaches:
1. **Generated Testing**: TypeScript templates → dynamic Python script generation → automated debugging validation
2. **Live Process Testing**: Persistent Python processes → external debugger attachment → interactive debugging workflows

This fixture collection enables end-to-end testing of Python debugging infrastructure from basic process attachment through complex multi-module debugging scenarios and MCP server integration.