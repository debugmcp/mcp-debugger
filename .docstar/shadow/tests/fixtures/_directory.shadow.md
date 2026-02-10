# tests/fixtures/
@generated: 2026-02-10T01:19:58Z

## Overall Purpose
The `tests/fixtures` directory serves as a comprehensive test fixture collection for debugging tool validation and end-to-end testing across multiple programming environments. This module provides minimal, controlled execution environments designed to test debugger functionality, debug adapter protocols, breakpoint management, and debugging workflow integration without the complexity of real-world applications.

## Key Components and Integration

### Multi-Language Debug Target Coverage
- **JavaScript/TypeScript**: `javascript-e2e/app.ts` for TypeScript debugging and source map testing
- **Python**: Multiple debug scenarios from simple execution to error handling and variable inspection
- **Cross-Platform Testing**: Consistent patterns across language environments for unified debugging tool validation

### Debug Protocol Infrastructure
- **Mock Adapters**: JavaScript mock testing environment (`debug-scripts/simple-mock.js`)
- **DAP Server Simulation**: Python-based Debug Adapter Protocol server (`python/debugpy_server.py`)
- **Protocol Compliance Testing**: Realistic debugging protocol interactions for MCP Server integration

### Comprehensive Debugging Scenarios
- **Normal Execution Flow**: Basic breakpoint and step-through testing
- **Exception Handling**: Intentional error generation for error handling validation
- **Variable Inspection**: Multi-scope variable testing across different data types
- **Source Map Support**: TypeScript compilation boundary debugging

## Public API Surface

### Primary Entry Points
- **`debug-scripts/`**: Language-specific minimal debugging fixtures
  - `simple.py`, `with-errors.py`, `with-variables.py`: Python debugging scenarios
  - `simple-mock.js`: JavaScript mock adapter testing
- **`javascript-e2e/app.ts`**: TypeScript end-to-end debugging validation
- **`python/debug_test_simple.py`**: Comprehensive Python debugging target
- **`python/debugpy_server.py`**: DAP protocol testing server

### Standard Execution Patterns
- **JavaScript**: Direct function execution via `main()` calls
- **Python**: Standard `if __name__ == "__main__"` pattern with documented entry points
- **Breakpoint Markers**: Consistent `// BREAK_HERE` and line number documentation for automated testing

## Internal Organization and Data Flow

### Test Isolation Design
Each fixture operates independently with no inter-dependencies, enabling:
- Isolated testing of specific debugging scenarios
- Predictable, deterministic execution for automated test harnesses
- Minimal external dependencies to reduce test environment complexity

### Debugging Workflow Support
1. **Target Preparation**: Fixtures provide controlled execution environments
2. **Breakpoint Validation**: Strategic pause points for debugger attachment testing
3. **Protocol Testing**: DAP server simulation for debugging protocol validation
4. **Output Verification**: Consistent, testable output for assertion validation

### Cross-Language Consistency
- **Uniform Output Patterns**: Arithmetic operations (10 + 20 = 30) across multiple fixtures
- **Standardized Breakpoint Locations**: Documented line numbers and comment markers
- **Common Testing Patterns**: Exception scenarios, variable inspection, and normal execution flow

## Important Patterns and Conventions

### Fixture Design Principles
- **Minimal Complexity**: Simple programs focus testing on debugging infrastructure rather than application logic
- **Predictable Behavior**: Consistent outputs enable reliable automated testing
- **Clear Instrumentation**: Explicit breakpoint markers and variable placements for test automation
- **Protocol Compliance**: Proper DAP message formatting and standard port usage (5678)

### Testing Integration
- **Mock Environment Support**: Validates debugging tools without complex execution overhead
- **End-to-End Coverage**: Complete debugging workflow testing from attachment to variable inspection
- **Multi-Platform Validation**: JavaScript and Python fixtures support cross-platform debugging tool development

This fixture collection enables comprehensive testing of debugging capabilities across different programming languages and debugging protocols, providing the foundation for validating MCP Server debugging functionality and ensuring robust debugging tool integration.