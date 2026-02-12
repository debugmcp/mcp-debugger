# examples\javascript/
@generated: 2026-02-12T21:05:47Z

## Purpose

JavaScript testing suite for MCP (Model Context Protocol) debugger validation. This directory provides comprehensive test scenarios designed to exercise various debugging features across different JavaScript environments, including native JavaScript, TypeScript, and Node.js contexts.

## Key Components

### Core Test Scripts
- **simple_test.js** & **test-simple.js**: Minimal smoke tests with basic arithmetic operations for initial debugger validation
- **pause_test.js**: Basic computation patterns with embedded breakpoint markers for stepping functionality
- **javascript_test_comprehensive.js**: Full-featured test suite with recursive functions, loops, objects, and conditional logic
- **mcp_target.js**: Focused debugging scenarios for stack traces, variable inspection, and expression evaluation

### Advanced Testing
- **test_complete_js_debug.js** & **test_javascript_debug.js**: Comprehensive debugging demonstrations showcasing mixed programming paradigms (recursive, iterative, functional)
- **typescript_test.ts** & **typescript_test.js**: TypeScript debugging scenarios including source map resolution, generic types, async operations, and transpilation artifacts

### Testing Architecture Patterns
- **Progressive complexity**: Tests range from simple variable swaps to complex nested data structures
- **Strategic breakpoints**: Explicit console.log statements and comments marking optimal breakpoint locations
- **Diverse data types**: Number, string, array, object, and TypeScript-specific types for comprehensive variable inspection
- **Multiple paradigms**: Recursive functions, iterative loops, async/await, object-oriented patterns, and functional programming

## Public API Surface

### Main Entry Points
- Each test script is self-executing with `main()` orchestrator functions
- Scripts use Node.js shebang (`#!/usr/bin/env node`) for direct execution
- TypeScript files include source map references for debugging original source

### Core Test Functions
- **Mathematical operations**: `fibonacci()`, `factorial()`, `calculateSum()` for recursive/iterative testing
- **Data processing**: `sumList()`, `processData()` for array manipulation debugging
- **Stack testing**: `deepFunction()` for call stack depth validation
- **Variable inspection**: `testVariables()` for diverse data type examination
- **Async patterns**: `fetchData()` for Promise-based debugging scenarios

## Internal Organization

### Test Scenario Categories
1. **Smoke Tests**: Basic execution validation (simple_test.js, test-simple.js)
2. **Breakpoint Testing**: Strategic pause points for stepping (pause_test.js)
3. **Feature Comprehensive**: Full debugger capability validation (javascript_test_comprehensive.js, mcp_target.js)
4. **Language-Specific**: TypeScript debugging with source maps and type inspection
5. **Error Handling**: Exception throwing and stack trace testing

### Data Flow Pattern
1. Script initialization with test data setup
2. Sequential test execution through main() orchestrator
3. Console logging for test progress and result verification
4. Error handling with process.exit() for failure cases

## Important Conventions

### Debugging-Specific Design
- **Breakpoint markers**: Comments explicitly identifying optimal breakpoint locations
- **Variable diversity**: Mixed primitive and complex types in each test scenario
- **Output consistency**: Standardized console.log patterns for test phase identification
- **Stack depth control**: Predictable recursion levels for stack trace testing
- **Source map integration**: TypeScript files maintain line number references for debugging mapping

### Cross-Language Testing
- Equivalent test implementations across JavaScript and TypeScript
- Consistent function signatures and test patterns
- Parallel debugging scenarios for language-agnostic debugger validation

This directory serves as a comprehensive validation suite for JavaScript/TypeScript debugging tools, providing systematic test coverage from basic stepping functionality to advanced source map resolution and type inspection capabilities.