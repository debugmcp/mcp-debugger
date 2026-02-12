# tests\fixtures/
@generated: 2026-02-12T21:01:08Z

## Overall Purpose

The `tests/fixtures` directory provides comprehensive test fixtures for validating debugging functionality across multiple programming languages and testing scenarios. It serves as a controlled testing environment for MCP Server debugging capabilities, offering minimal, predictable programs and mock infrastructure designed specifically for automated testing of debugger attachment, protocol communication, breakpoint handling, and variable inspection.

## Key Components and Organization

The directory is organized into three specialized subdirectories, each serving distinct testing purposes:

### Debug-Scripts (Cross-Language Basic Testing)
- **Python fixtures**: `simple.py`, `with-errors.py`, `with-variables.py` for core debugging scenarios
- **JavaScript fixture**: `simple-mock.js` for mock adapter and path validation
- **Purpose**: Basic execution testing, error handling validation, and variable inspection across different programming languages

### JavaScript-E2E (End-to-End Testing)
- **app.ts**: TypeScript fixture for comprehensive E2E debugging validation
- **Purpose**: Testing JavaScript/TypeScript debugging capabilities, source map support, and breakpoint handling in realistic execution environments

### Python (Debugging Infrastructure Testing)
- **debug_test_simple.py**: Target application for debugging attachment testing
- **debugpy_server.py**: Mock DAP (Debug Adapter Protocol) server implementation
- **Purpose**: Testing both debugger targets and debugging protocol communication infrastructure

## Public API Surface

### Primary Entry Points
- **Target Applications**: All fixture scripts are self-contained executables with standard entry points (`if __name__ == "__main__"` for Python, direct invocation for JavaScript/TypeScript)
- **Mock Infrastructure**: `debugpy_server.py` provides a DAP-compliant server on port 5678 for protocol testing
- **Breakpoint Markers**: Standardized `// BREAK_HERE` comments and strategic line positioning for automated test breakpoint placement

### Testing Interfaces
- **Linear Execution**: Simple start-to-finish flows for basic debugging functionality validation
- **Error Scenarios**: Controlled exception generation for testing error handling capabilities
- **Variable Inspection**: Multi-type, multi-scope variable scenarios for state inspection testing
- **Protocol Communication**: DAP-compliant message handling for debugging protocol validation

## Internal Data Flow and Integration

The fixtures follow a complementary three-tier testing architecture:

1. **Basic Functionality Layer** (debug-scripts): Validates core debugging operations across languages
2. **Integration Layer** (javascript-e2e): Tests realistic debugging workflows with compilation and source mapping
3. **Infrastructure Layer** (python): Tests both target applications and debugging server communication

## Important Patterns and Conventions

### Testing Standards
- **Minimal Dependencies**: Standard library only to avoid test environment complications
- **Predictable Behavior**: Consistent execution flows and well-defined breakpoint locations
- **Strategic Markers**: Comment-based breakpoint indicators for test automation integration
- **Self-Contained Design**: No external state dependencies or complex setup requirements

### Language Coverage
- **Python**: Complete debugging scenario coverage from basic execution to protocol communication
- **JavaScript/TypeScript**: E2E testing with transpilation and source map validation
- **Cross-Language**: Consistent testing patterns across different runtime environments

## Role in Larger System

This fixture directory enables comprehensive automated testing of MCP Server debugging capabilities by providing:
- Controlled debugging targets for attachment and inspection testing
- Mock infrastructure for protocol communication validation
- Cross-language compatibility testing across Python and JavaScript/TypeScript environments
- End-to-end workflow validation from debugger attachment through variable inspection and execution control

The fixtures collectively support the validation of debugging functionality without requiring complex applications or full debugging infrastructure installations, making them ideal for CI/CD testing environments and development validation workflows.