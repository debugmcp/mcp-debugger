# examples/javascript/
@generated: 2026-02-10T21:26:24Z

## Purpose

The `examples/javascript` directory serves as a comprehensive test suite for JavaScript/TypeScript debugging capabilities in the Model Context Protocol (MCP) debugger. It provides a collection of carefully crafted test scripts that exercise various debugging features including breakpoints, stack traces, variable inspection, expression evaluation, and source map resolution.

## Key Components

### Core Test Scripts
- **`simple_test.js`** & **`test-simple.js`**: Minimal debugging examples with basic variable operations and arithmetic for smoke testing
- **`pause_test.js`**: Focused on control flow and computation patterns with explicit breakpoint markers
- **`javascript_test_comprehensive.js`**: Extensive test scenarios covering recursive functions, loops, objects, and conditional logic
- **`mcp_target.js`** & **`test_complete_js_debug.js`**: Deep debugging demonstrations with stack traces and variable inspection
- **`test_javascript_debug.js`**: Comprehensive computational operations testing with mixed iteration patterns

### TypeScript Testing
- **`typescript_test.ts`**: Source TypeScript file with type interfaces, generics, async operations, and complex data structures
- **`typescript_test.js`**: Transpiled output with source map references for testing TypeScript debugging workflows

## Public API Surface

### Primary Entry Points
Each test script is self-executing with a `main()` function as the orchestrator:
- All scripts are directly executable via Node.js (shebang headers)
- `main()` functions serve as test harnesses for different debugging scenarios
- Scripts can be run individually or as part of a comprehensive test suite

### Test Categories
1. **Basic Operations**: Variable swapping, arithmetic, simple breakpoints
2. **Control Flow**: Loops, conditionals, recursive functions
3. **Data Structures**: Arrays, objects, nested data manipulation
4. **Async Operations**: Promise-based testing, await patterns
5. **Error Handling**: Exception throwing, stack trace validation
6. **Type System**: TypeScript generics, interfaces, union types

## Internal Organization

### Common Patterns
- **Breakpoint Markers**: Strategic console.log statements and comments marking optimal breakpoint locations
- **Progressive Complexity**: Tests range from simple arithmetic to complex nested data structures
- **Variable Diversity**: Each script includes multiple variable types (primitives, arrays, objects) for inspection testing
- **Function Decomposition**: Utility functions (factorial, fibonacci, sum calculations) for step-through debugging

### Data Flow
1. **Initialization**: Scripts set up test variables and data structures
2. **Execution**: Sequential test scenarios with clear console output separation
3. **Validation**: Results logged for verification of debugger accuracy
4. **Error Handling**: Process exit patterns and exception catching for failure scenarios

## Testing Architecture

### JavaScript Debugging Features
- **Stack Traces**: Recursive functions creating predictable call depths
- **Variable Inspection**: Mixed primitive and complex object types
- **Expression Evaluation**: Runtime arithmetic and object property access
- **Breakpoint Placement**: Strategic locations for step-through debugging

### TypeScript-Specific Testing
- **Source Maps**: Transpiled code with original line number references
- **Type System**: Generics, interfaces, union types for type inspection
- **Modern Features**: Async/await, destructuring, template literals
- **Compilation Artifacts**: Transpilation helpers (__awaiter, __generator) for tooling validation

## Integration Points

The directory serves as a comprehensive validation suite for MCP debugger implementations, ensuring compatibility across:
- Pure JavaScript debugging scenarios
- TypeScript source map resolution
- Async operation debugging
- Complex data structure inspection
- Error handling and stack trace generation

Each test script is designed to be both standalone and part of a larger debugging validation workflow, making this directory essential for verifying MCP debugger functionality across diverse JavaScript/TypeScript development scenarios.