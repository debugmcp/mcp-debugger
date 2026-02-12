# examples/javascript/
@generated: 2026-02-11T23:47:47Z

## Purpose

The `examples/javascript` directory provides a comprehensive test suite for JavaScript and TypeScript debugging tools, specifically designed for testing MCP (Model Context Protocol) debugger functionality. It serves as a validation harness for debugging features including breakpoints, stack traces, variable inspection, expression evaluation, and source map resolution.

## Key Components

### Test Categories

**Simple Tests**
- `simple_test.js` - Basic variable swap operation with ES6 destructuring
- `test-simple.js` - Minimal arithmetic operations and console logging
- `pause_test.js` - Basic computation patterns with explicit breakpoint markers

**Comprehensive Tests**
- `javascript_test_comprehensive.js` - Full JavaScript feature testing including recursion, iteration, objects, and conditional logic
- `test_javascript_debug.js` - Multi-faceted debugging scenarios with factorial, array operations, and data processing
- `mcp_target.js` - Specialized MCP debugger testing with deep recursion and variable inspection

**Advanced Language Features**
- `typescript_test.ts` - TypeScript source with interfaces, generics, async/await, and complex type structures
- `typescript_test.js` - Transpiled JavaScript output with source maps for TypeScript debugging scenarios
- `test_complete_js_debug.js` - Production-style debugging with async orchestration and error handling

### Common Patterns

**Debugging Infrastructure**
- Strategic breakpoint placement with explicit comments marking optimal debugging locations
- Console logging throughout execution for visibility
- Progressive complexity from simple variables to nested objects and async operations
- Error handling scenarios for stack trace testing

**Mathematical Operations**
- Fibonacci sequence (recursive implementation)
- Factorial calculations (both recursive and iterative)
- Array summation and data transformation
- Arithmetic operations with null-safe handling

**Data Structures**
- Simple primitives (numbers, strings)
- Arrays with iteration patterns
- Complex nested objects with metadata
- TypeScript interfaces demonstrating type inspection

## Public API Surface

### Entry Points
- Each file is self-executing via `main()` functions or direct script execution
- Node.js shebang headers enable direct execution (`#!/usr/bin/env node`)
- Modular function exports (e.g., `export function main()` in simple_test.js)

### Test Functions
- **Recursive functions**: `fibonacci()`, `factorial()`, `deepFunction()`
- **Array processors**: `calculateSum()`, `sumList()`, `processData()`
- **Data generators**: `fetchData()`, `testVariables()`
- **Utility functions**: `swap()`, `compute()`, `throwTestError()`

## Internal Organization

### Data Flow
1. **Initialization**: Test data setup with diverse variable types
2. **Execution**: Sequential test scenarios with isolated console output sections
3. **Validation**: Console logging for each operation to verify correct execution
4. **Completion**: Final result computation and logging

### Test Architecture
- **Smoke tests**: Basic functionality verification (simple_test.js, test-simple.js)
- **Feature tests**: Specific debugging capability validation (breakpoints, stack traces)
- **Integration tests**: Complex scenarios combining multiple debugging features
- **Language tests**: TypeScript-specific features with source map testing

### File Relationships
- TypeScript source (`typescript_test.ts`) and its transpiled output (`typescript_test.js`) demonstrate source map debugging
- Progressive complexity from minimal examples to comprehensive test suites
- Consistent naming convention with `test_` or `_test` patterns
- Cross-language equivalence (JavaScript implementations mirror debugging patterns)

## Important Patterns

### Debugging Best Practices
- **Breakpoint markers**: Explicit comments indicating optimal breakpoint placement
- **Variable diversity**: Mixed data types (primitives, arrays, objects, nested structures) for inspection testing
- **Call stack depth**: Recursive functions creating predictable stack traces
- **Async patterns**: Promise-based operations for async debugging scenarios

### Code Organization
- **Single responsibility**: Each file focuses on specific debugging scenarios
- **Self-contained**: No external dependencies beyond Node.js runtime
- **Executable design**: All files can run independently for isolated testing
- **Error boundaries**: Explicit error handling with process.exit() patterns

This directory serves as the definitive test suite for validating JavaScript/TypeScript debugging tool functionality, providing both simple smoke tests and complex real-world debugging scenarios.