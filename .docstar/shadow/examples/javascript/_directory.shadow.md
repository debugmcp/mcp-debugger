# examples\javascript/
@children-hash: f72111b79c0ab106
@generated: 2026-02-24T01:54:59Z

## Purpose

The `examples/javascript` directory provides a comprehensive test suite for JavaScript debugging scenarios in the MCP (Model Context Protocol) environment. This collection serves as a debugging validation framework, offering diverse JavaScript and TypeScript code patterns to test debugger functionality including breakpoints, stack traces, variable inspection, and expression evaluation.

## Key Components

### Core Test Scripts

**Simple Test Cases**
- `simple_test.js` & `test-simple.js`: Minimal debugging examples with basic arithmetic and variable swapping operations. Designed for smoke testing debugger setup and basic functionality.
- `pause_test.js`: Basic computation patterns with explicit breakpoint markers for step-through debugging validation.

**Comprehensive Test Suites**
- `javascript_test_comprehensive.js`: Full-featured test script containing recursive functions (Fibonacci, factorial), array processing, object manipulation, and conditional logic scenarios.
- `mcp_target.js` & `test_complete_js_debug.js`: Specialized debugging targets featuring deep recursive functions, complex variable structures, and async operations for testing stack frame inspection and variable evaluation.
- `test_javascript_debug.js`: Mathematical computation testing with factorial calculations, array summation, and data transformation functions.

**TypeScript Integration**
- `typescript_test.ts`: Source TypeScript file with comprehensive debugging scenarios including generics, interfaces, classes, async operations, and error handling.
- `typescript_test.js`: Transpiled JavaScript output demonstrating source map debugging capabilities and TypeScript-to-JavaScript breakpoint mapping.
- `tsconfig.json`: TypeScript compilation configuration targeting ES2020 with strict type checking and source map generation.

## Architecture & Organization

### Test Complexity Progression
The examples are organized by debugging complexity:
1. **Basic**: Simple variable operations and arithmetic (`simple_test.js`, `test-simple.js`)
2. **Intermediate**: Function calls and control flow (`pause_test.js`, `test_javascript_debug.js`)
3. **Advanced**: Recursive functions, async operations, and complex data structures (`javascript_test_comprehensive.js`, `mcp_target.js`)
4. **TypeScript**: Source map debugging and TypeScript-specific features (`typescript_test.ts/.js`)

### Common Patterns
- **Strategic Breakpoints**: Each file includes explicit breakpoint markers and console.log statements at key debugging locations
- **Variable Diversity**: Tests include numbers, strings, arrays, nested objects, and class instances for comprehensive variable inspection
- **Stack Trace Testing**: Recursive functions and nested calls create predictable call stacks for debugger validation
- **Error Scenarios**: Exception handling and stack trace generation for debugging error conditions

## Public API Surface

### Entry Points
All test scripts are executable Node.js files with shebang headers:
- Direct execution via `node <filename>.js`
- Main function orchestration pattern (`main()` functions)
- Self-executing scripts for immediate testing

### Key Test Functions
- **Recursive Patterns**: `fibonacci()`, `factorial()`, `deepFunction()` for stack trace testing
- **Data Processing**: `calculateSum()`, `sumList()`, `processData()` for array manipulation debugging
- **Async Operations**: `fetchData()` for Promise and async/await debugging
- **Object-Oriented**: `Calculator` class methods for method stepping and instance inspection

## Internal Organization

### Data Flow
1. **Initialization**: Test data setup with diverse variable types
2. **Execution**: Sequential test scenario execution with console logging
3. **Validation**: Return values and side effects for debugging verification

### Debug Features Tested
- **Breakpoint Placement**: Strategic pause points in loops, function calls, and variable assignments
- **Variable Inspection**: Complex nested objects, arrays, and primitive types
- **Stack Traces**: Multi-level recursive calls and error stack generation
- **Expression Evaluation**: Arithmetic operations and object property access
- **Source Maps**: TypeScript-to-JavaScript debugging mapping

## Integration Context

This directory serves as a debugging test harness for the MCP framework, providing standardized JavaScript/TypeScript examples to validate debugger implementation across different scenarios. The examples cover the full spectrum of JavaScript debugging requirements from basic variable inspection to complex async operation debugging, ensuring comprehensive debugger functionality validation.