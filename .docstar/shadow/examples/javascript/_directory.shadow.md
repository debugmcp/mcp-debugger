# examples\javascript/
@generated: 2026-02-12T21:00:58Z

## Directory Purpose

The `examples/javascript` directory contains a comprehensive collection of JavaScript and TypeScript test files designed specifically for debugging tool validation and MCP (Model Context Protocol) debugger testing. This module serves as a test harness that exercises various debugging scenarios across different JavaScript language features and execution patterns.

## Key Components and Organization

### Core Test Files

**Basic Test Scripts**
- `simple_test.js` / `test-simple.js`: Minimal smoke tests for basic debugger functionality
- `pause_test.js`: Focused on breakpoint placement and basic computation patterns

**Comprehensive Test Suites**
- `javascript_test_comprehensive.js`: Full-featured test covering recursive functions, loops, arrays, and mathematical operations
- `test_javascript_debug.js`: Advanced debugging scenarios with factorial calculations, array processing, and nested function calls
- `mcp_target.js` / `test_complete_js_debug.js`: Specialized MCP debugger testing with stack trace validation and variable inspection

**TypeScript Integration**
- `typescript_test.ts`: Original TypeScript source with advanced type features, generics, and async operations
- `typescript_test.js`: Transpiled JavaScript with source map support for TypeScript debugging scenarios

## Public API Surface

### Primary Entry Points
All test files are self-executing Node.js scripts with consistent patterns:
- `main()` functions as primary orchestrators
- Direct script execution via `main().catch()` or immediate invocation
- Node.js shebang for direct execution (`#!/usr/bin/env node`)

### Common Test Scenarios
- **Variable Inspection**: Mixed data types (numbers, strings, arrays, objects, nested structures)
- **Stack Trace Testing**: Recursive functions with configurable depth levels
- **Breakpoint Validation**: Strategic console.log statements and marked breakpoint locations
- **Control Flow**: Loops, conditionals, function calls, and exception handling
- **Async Operations**: Promise-based testing with artificial delays

## Internal Data Flow

### Test Execution Pattern
1. **Initialization**: Variable setup and test data preparation
2. **Sequential Testing**: Progressive complexity from simple arithmetic to complex nested operations
3. **Output Generation**: Comprehensive console logging for debugging visibility
4. **Error Handling**: Controlled exception scenarios for stack trace testing

### Cross-File Consistency
- Shared debugging patterns across all test files
- Consistent variable naming (x, y, z for simple tests; testData for complex scenarios)
- Similar function signatures for comparable operations (factorial, sum, swap patterns)
- Unified console output formatting

## Important Patterns and Conventions

### Debugging-Specific Design
- **Strategic Breakpoints**: Explicit comments marking intended breakpoint locations
- **Variable Diversity**: Each test includes multiple data types for comprehensive inspection
- **Progressive Complexity**: Tests move from simple operations to complex nested structures
- **Source Map Integration**: TypeScript files include transpiled versions with debugging metadata

### Architecture Conventions
- **No External Dependencies**: All tests use only Node.js built-ins for maximum portability
- **Functional Decomposition**: Clear separation of concerns with dedicated utility functions
- **Error Isolation**: Each test scenario includes proper error handling and recovery

### Testing Methodology
- **Comprehensive Coverage**: Tests span recursive calls, iterative operations, object manipulation, and async patterns
- **Cross-Language Validation**: TypeScript and JavaScript variants for tooling compatibility
- **Reproducible Scenarios**: Deterministic outputs for consistent debugging validation

This directory serves as a complete debugging validation suite, enabling thorough testing of JavaScript/TypeScript debugging tools across the full spectrum of language features and execution patterns.