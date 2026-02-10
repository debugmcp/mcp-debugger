# examples/javascript/
@generated: 2026-02-10T01:19:44Z

## Overall Purpose and Responsibility

The `examples/javascript` directory serves as a comprehensive test suite for JavaScript/TypeScript debugging capabilities in the MCP (Model Context Protocol) system. It provides a collection of carefully crafted test scripts designed to validate debugger functionality across various JavaScript/TypeScript scenarios including breakpoints, stack traces, variable inspection, expression evaluation, and source map handling.

## Key Components and Organization

The directory contains two primary categories of test files:

### Core JavaScript Test Files
- **`simple_test.js`** & **`test-simple.js`**: Basic smoke tests with minimal operations (variable swaps, arithmetic)
- **`pause_test.js`**: Breakpoint-focused testing with computed operations and control flow
- **`javascript_test_comprehensive.js`**: Full-featured test covering recursive functions, loops, arrays, and conditional logic
- **`mcp_target.js`**: Specialized target for stack trace depth and variable inspection testing
- **`test_javascript_debug.js`**: Comprehensive debugging scenarios with factorial, array processing, and nested function calls
- **`test_complete_js_debug.js`**: Advanced debugging demonstration with async patterns and complex data structures

### TypeScript Integration
- **`typescript_test.ts`**: Source TypeScript file with comprehensive type system testing (interfaces, generics, classes, async operations)
- **`typescript_test.js`**: Transpiled output with source map references for TypeScript debugging validation

## Public API Surface and Entry Points

All test files are self-executing Node.js scripts with consistent entry patterns:

- **Direct execution**: Files use Node.js shebang (`#!/usr/bin/env node`) for command-line execution
- **Main function pattern**: Most files implement a `main()` function as the primary orchestrator
- **Error handling**: Scripts include proper error handling with `process.exit(1)` on failures
- **Console output**: Extensive logging throughout for debugging visibility and test progress tracking

## Internal Organization and Data Flow

### Test Complexity Progression
The files are organized by increasing complexity:
1. **Basic operations**: Simple arithmetic and variable manipulation
2. **Control flow**: Loops, conditionals, and function calls
3. **Advanced patterns**: Recursion, async operations, and object-oriented programming
4. **TypeScript features**: Type system, generics, interfaces, and source map debugging

### Common Test Patterns
- **Breakpoint markers**: Strategic console.log statements and comments marking intended breakpoint locations
- **Variable diversity**: Mixed data types (primitives, arrays, objects, nested structures) for inspection testing
- **Stack trace generation**: Recursive functions and nested calls for call stack examination
- **Expression evaluation**: Arithmetic operations and object property access for evaluator testing

## Important Patterns and Conventions

### Debugging-Specific Design
- **Predictable execution flow**: Linear progression through test scenarios for consistent debugging experiences
- **Strategic breakpoint placement**: Explicit comments marking "good for breakpoint" locations
- **Progressive data complexity**: Tests start simple and build to complex nested structures
- **Cross-language compatibility**: JavaScript tests mirror TypeScript functionality for comparative debugging

### Test Isolation
- Each file represents a self-contained debugging scenario
- No external dependencies beyond Node.js built-ins
- Clear separation of concerns with distinct computational functions
- Consistent error handling and output patterns

### Source Map Integration
The TypeScript components demonstrate source map debugging with:
- Original TypeScript source preservation
- Transpiled JavaScript with line number mappings
- Source map references for debugger resolution
- Breakpoint comments referencing original TypeScript line numbers

This directory serves as the definitive test suite for validating MCP debugger capabilities across the JavaScript/TypeScript ecosystem, providing both simple smoke tests and comprehensive debugging scenarios for thorough validation.