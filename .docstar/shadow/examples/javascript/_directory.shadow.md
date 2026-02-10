# examples/javascript/
@generated: 2026-02-09T18:16:14Z

## Purpose
The `examples/javascript` directory contains a comprehensive test suite for validating JavaScript/TypeScript debugging capabilities within MCP (Model Context Protocol) environments. This collection serves as both a validation framework for debugger functionality and a demonstration of various debugging scenarios across different JavaScript language features.

## Core Components

### Test Scripts by Complexity Level

**Simple Tests**
- `simple_test.js` and `test-simple.js`: Minimal debugging scenarios with basic variable manipulation and arithmetic operations
- Entry points for smoke testing debugger connectivity and basic stepping functionality

**Intermediate Tests** 
- `pause_test.js`: Mathematical computations with strategic breakpoint locations
- `mcp_target.js`: Structured debugging validation with stack depth testing and variable inspection scenarios

**Comprehensive Test Suites**
- `javascript_test_comprehensive.js`: Full-featured test covering recursive functions, iterative algorithms, object manipulation, and mixed programming paradigms
- `test_complete_js_debug.js` and `test_javascript_debug.js`: Specialized debugging harnesses with explicit breakpoint markers and variable inspection points
- `typescript_test.ts/.js`: Advanced TypeScript debugging scenarios including source map resolution, generic types, async operations, and complex data structures

## Key Testing Capabilities

### Debugging Feature Coverage
- **Breakpoint Management**: Strategic breakpoint locations marked with comments across all test files
- **Stack Trace Inspection**: Recursive functions (`deepFunction`, `fibonacci`) create controlled call stacks
- **Variable Inspection**: Comprehensive data type coverage including primitives, arrays, objects, and nested structures
- **Expression Evaluation**: Mathematical computations and transformations for runtime expression testing
- **Async Debugging**: Promise-based operations and async/await patterns (TypeScript suite)
- **Error Handling**: Controlled exception scenarios for stack trace validation

### Language Feature Testing
- **Function Types**: Pure functions, recursive algorithms, iterative implementations, arrow functions
- **Data Structures**: Arrays, objects, nested data, generic types, union types, Record types
- **Control Flow**: Conditional logic, loops, error handling, async operations
- **Scoping**: Local variables, function parameters, class instance members

## Public API Surface

### Main Entry Points
All test files are self-executing with `main()` functions as primary orchestrators:
- Direct execution via Node.js shebang (`#!/usr/bin/env node`)
- Async main functions with error handling and process exit codes
- Console-driven output for debugging session visibility

### Test Data Providers
- Static test configurations (`testData` objects) for consistent debugging scenarios
- Hardcoded input values for predictable debugging outcomes
- Graduated complexity from simple arithmetic to complex nested structures

## Internal Organization

### Execution Patterns
- **Sequential Test Execution**: Each file runs tests in predetermined order
- **Self-Contained Scenarios**: No cross-file dependencies, each file is independently executable
- **Console Logging**: Structured output with test boundaries and progress indicators
- **Error Handling**: Graceful failure with exit codes for automated testing

### Code Architecture
- **Functional Decomposition**: Single-responsibility functions for isolated debugging
- **Mixed Paradigms**: Recursive vs iterative implementations for different debugging scenarios
- **Pure Functions**: Predictable state for reliable debugging sessions (except console output)
- **TypeScript Compilation**: Source map generation for advanced debugging features

## Key Conventions

### Breakpoint Marking
- Strategic comment placement indicating optimal breakpoint locations
- Line number references for cross-language debugging consistency
- Graduated complexity breakpoints from simple variable inspection to complex async operations

### Test Structure
- Consistent naming patterns (`test_*`, `*_test.js`)
- Standard `main()` orchestration functions
- Error handling with process exit codes
- Console output for debugging session validation

## Integration Context
This test suite serves as the JavaScript/TypeScript component of a broader MCP debugging validation framework, providing language-specific debugging scenarios while maintaining consistency with other language implementations in the MCP ecosystem.