# tests/fixtures/
@generated: 2026-02-11T23:47:55Z

## Overall Purpose

The `tests/fixtures` directory provides a comprehensive collection of test fixtures and mock environments for validating debugging functionality across multiple programming languages and protocols. This testing infrastructure enables automated verification of debugger implementations, IDE integrations, and debugging workflow tools within the MCP Server ecosystem.

## Key Components & Architecture

### Multi-Language Debug Targets
- **Python fixtures** (`python/`): Complete debugging ecosystem with target applications and DAP server simulation
- **JavaScript/TypeScript fixtures** (`javascript-e2e/`): TypeScript debugging validation with source map support  
- **Cross-language debug scripts** (`debug-scripts/`): Standalone debugging scenarios for breakpoint and variable inspection testing

### Testing Scope Coverage
1. **Protocol Testing**: DAP (Debug Adapter Protocol) server simulation and command processing validation
2. **Breakpoint Validation**: Strategic breakpoint placement across different language contexts
3. **Variable Inspection**: Multi-scope variable testing including nested functions and type annotations
4. **Error Handling**: Controlled exception scenarios for debugging error workflows
5. **Source Map Integration**: TypeScript-to-JavaScript debugging accuracy verification

## Component Integration & Data Flow

The fixtures operate as a coordinated testing ecosystem:

1. **Target Applications**: Simple, predictable programs (`debug_test_simple.py`, `app.ts`, `simple.py`) that serve as debugging subjects
2. **Protocol Servers**: Mock DAP implementation (`debugpy_server.py`) for testing debugger communication protocols
3. **Scenario Scripts**: Specialized fixtures for testing specific debugging features (error handling, variable scopes, multi-language support)
4. **Test Coordination**: All components designed for integration with automated E2E testing frameworks

## Public API Surface

### Primary Entry Points
- **Python debugging**: `python/debug_test_simple.py` (target) + `python/debugpy_server.py` (DAP server on port 5678)
- **TypeScript debugging**: `javascript-e2e/app.ts` with explicit breakpoint markers
- **Scenario testing**: Individual scripts in `debug-scripts/` for specific debugging capabilities

### Standard Testing Interface
- **Breakpoint conventions**: `// BREAK_HERE` comments and line-specific markers (e.g., line 13 in Python fixtures)
- **Predictable execution flows**: Deterministic outputs and timing for automated assertion testing
- **Multi-language consistency**: Common debugging patterns across Python, JavaScript, and TypeScript

## Internal Organization Patterns

### Design Principles
- **Test isolation**: Each fixture is self-contained with minimal dependencies
- **Controlled complexity**: Simple execution paths to isolate debugging functionality from application logic  
- **Protocol compliance**: Standard DAP message handling with proper Content-Length framing
- **Graceful cleanup**: Signal handlers and proper session management for test teardown

### Common Architectural Elements
- **Standard library only**: No external dependencies to ensure reliable test environments
- **Explicit debug markers**: Comment-based breakpoint indicators and variable inspection points
- **Deterministic behavior**: Consistent outputs across executions for reliable automated testing
- **Modular design**: Independent components that can be composed for comprehensive debugging workflow validation

## Critical Testing Capabilities

This fixture collection enables comprehensive validation of:
- Debugger attachment and detachment workflows
- Breakpoint setting, hitting, and removal across multiple languages
- Variable inspection and scope analysis
- Exception handling and error debugging scenarios  
- Source map accuracy for compiled languages
- DAP protocol compliance and command processing
- Multi-language debugging tool integration

The directory serves as the foundation for automated debugging tool validation, providing the controlled environments necessary for reliable, repeatable testing of debugging functionality across the MCP Server ecosystem.