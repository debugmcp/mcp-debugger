# examples\javascript/
@children-hash: 4bc7d924d1f6e005
@generated: 2026-02-15T09:01:29Z

## Purpose

This directory contains JavaScript and TypeScript test files specifically designed for testing and validating MCP (Model Context Protocol) debugger functionality. The collection serves as a comprehensive test suite for debugging tools, providing various scenarios to exercise breakpoints, stack traces, variable inspection, expression evaluation, and source map resolution.

## Key Components

The directory is organized around different testing complexity levels and debugging scenarios:

### Simple Test Files
- **`test-simple.js`**: Basic arithmetic operations and console logging for environment verification
- **`simple_test.js`**: Minimal variable swap operation using ES6 destructuring, designed for basic breakpoint testing
- **`pause_test.js`**: Demonstrates basic computation with embedded breakpoint markers

### Comprehensive Test Suites
- **`javascript_test_comprehensive.js`**: Full-featured JavaScript debugging scenarios including recursive functions (fibonacci, factorial), array processing, and mixed programming paradigms
- **`test_javascript_debug.js`**: Advanced test script with recursive calculations, array operations, and nested function calls
- **`mcp_target.js`** & **`test_complete_js_debug.js`**: Specialized debugging targets with deep recursion testing and variable inspection scenarios

### TypeScript Integration
- **`typescript_test.ts`**: Original TypeScript source with comprehensive debugging scenarios including generics, classes, async operations, and complex data structures
- **`typescript_test.js`**: Transpiled JavaScript output with source map support for TypeScript debugging validation

## Architecture & Test Patterns

### Common Testing Strategies
- **Progressive Complexity**: Tests range from simple arithmetic to complex nested data structures and async operations
- **Strategic Breakpoint Placement**: All files include explicit breakpoint markers and comments indicating optimal debugging locations
- **Diverse Data Types**: Tests cover primitives, arrays, objects, classes, and TypeScript-specific constructs
- **Mixed Paradigms**: Combines functional, object-oriented, and procedural programming patterns

### Key Debugging Scenarios Covered
1. **Stack Trace Testing**: Deep recursive functions with predictable call depths
2. **Variable Inspection**: Diverse variable types and nested object structures
3. **Expression Evaluation**: Arithmetic operations and computed values
4. **Control Flow**: Loops, conditionals, and branching logic
5. **Async Debugging**: Promise-based operations and async/await patterns
6. **Error Handling**: Exception throwing and stack trace generation
7. **Source Maps**: TypeScript-to-JavaScript mapping for original source debugging

## Public API / Entry Points

All test files are designed as executable scripts with clear entry points:
- **Node.js Execution**: Files use shebang headers for direct execution
- **`main()` Functions**: Primary orchestrator functions in comprehensive test files
- **Self-Executing**: Most files automatically run their test scenarios when loaded
- **Console Output**: Extensive logging for debugging session visibility

## Internal Organization

### Data Flow Pattern
1. **Initialization**: Setup test data and variables
2. **Execution**: Run debugging scenarios in sequence
3. **Logging**: Output results and state information
4. **Error Handling**: Graceful failure with process.exit patterns

### Cross-Language Testing
The directory supports both JavaScript and TypeScript debugging workflows, with the TypeScript files providing source map testing capabilities while the JavaScript files offer direct debugging scenarios.

## Dependencies

- **Runtime**: Node.js environment
- **APIs**: Console API for logging, Process API for error handling
- **Language Features**: ES6+ syntax, async/await, destructuring, template literals
- **TypeScript**: Generic types, interfaces, classes (for .ts files)

This test suite serves as a comprehensive validation framework for MCP debugger implementations, ensuring coverage of all major JavaScript/TypeScript debugging features and scenarios.