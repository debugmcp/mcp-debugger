# tests\fixtures/
@children-hash: e42ac37552ca0ba4
@generated: 2026-02-24T01:55:07Z

## Overall Purpose

The `tests/fixtures` directory provides a comprehensive collection of test fixtures and debugging targets for validating MCP Server debugging capabilities across multiple programming languages and scenarios. It serves as a controlled test environment for verifying debugger functionality, protocol implementations, and debugging workflows.

## Key Components and Relationships

**Language-Specific Debug Targets:**
- **Debug Scripts (`debug-scripts/`)**: Simple, predictable scripts in JavaScript and Python for basic debugging workflow validation, including mock adapters, breakpoint testing, error handling, and variable inspection
- **Python Fixtures (`python/`)**: Comprehensive Python debugging test environment with both debuggee targets and mock DAP server infrastructure
- **JavaScript/TypeScript E2E (`javascript-e2e/`)**: End-to-end testing fixture for TypeScript debugging with source map validation and mixed JS/TS environment support

**Testing Infrastructure Components:**
- Mock debug servers implementing DAP (Debug Adapter Protocol)
- Build configurations optimized for debugging scenarios
- Strategic breakpoint markers and predictable execution flows
- Multi-language coverage spanning JavaScript, TypeScript, and Python

## Public API Surface

**Primary Entry Points:**
- `debug-scripts/simple.py`: Basic Python debugging workflow with marked breakpoint locations
- `debug-scripts/with-errors.py`: Exception handling and error debugging validation
- `debug-scripts/with-variables.py`: Variable inspection across data types and scopes
- `debug-scripts/simple-mock.js`: JavaScript fixture for mock adapter and path validation
- `python/debug_test_simple.py`: Comprehensive Python debuggee with predictable execution flow
- `python/debugpy_server.py`: Mock DAP server for protocol testing (default port 5678)
- `javascript-e2e/app.ts`: TypeScript debugging target with source map support

**Integration Patterns:**
- All fixtures follow minimal dependency principle (standard library only)
- Consistent breakpoint marking with comment annotations (`// BREAK_HERE`, line documentation)
- Command-line execution patterns with standard guards (`if __name__ == "__main__"`)

## Internal Organization and Data Flow

**Testing Architecture Layers:**
1. **Debug Targets**: Simple, predictable programs designed to be debugged
2. **Protocol Infrastructure**: Mock servers and adapters for testing debugging protocols
3. **Build/Configuration**: TypeScript compilation and source map generation for debugging verification

**Test Scenario Coverage:**
- **Breakpoint Testing**: Strategic placement and automated verification
- **Variable Inspection**: Multiple data types, scopes, and state changes
- **Exception Handling**: Controlled error generation and debugging
- **Source Map Validation**: TypeScript-to-JavaScript debugging workflows
- **Protocol Compliance**: DAP message handling and debugging server interactions

**Cross-Language Integration:**
The fixtures collectively enable end-to-end testing of debugging capabilities across JavaScript, TypeScript, and Python environments, with mock infrastructure supporting protocol-level testing and validation.

## Important Patterns and Conventions

**Test Design Principles:**
- **Minimal Complexity**: All fixtures intentionally simple to focus testing on debugging capabilities
- **Predictable Behavior**: Known outputs and execution paths for reliable automated testing
- **Automation-Friendly**: Comment markers, designated breakpoints, and consistent execution patterns
- **Self-Contained**: No external dependencies to minimize test environment complexity

**Protocol and Standards Compliance:**
- DAP (Debug Adapter Protocol) message framing with Content-Length headers
- Standard debugpy port usage and graceful shutdown handling
- Source map generation and TypeScript debugging workflow support
- Multi-environment compatibility for mixed JavaScript/TypeScript projects

This fixture directory provides the essential testing infrastructure for validating comprehensive debugging capabilities across multiple languages and debugging scenarios within the MCP Server ecosystem.