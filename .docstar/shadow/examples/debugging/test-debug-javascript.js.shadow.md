# examples/debugging/test-debug-javascript.js
@source-hash: 7b3844907faa5a88
@generated: 2026-02-10T00:41:35Z

**Purpose**: Test script for debugging JavaScript applications with MCP debugger. Provides a comprehensive set of debugging scenarios including arithmetic operations, array processing, recursion, and object manipulation.

**Core Functions**:
- `calculateProduct(a, b)` (L6-11): Performs multiplication of two numbers with console logging for trace visibility
- `processArray(items)` (L13-21): Iterates through array elements, logs each item, and calculates sum using traditional for-loop
- `fibonacci(n)` (L23-30): Recursive implementation of Fibonacci sequence calculation with base case handling
- `main()` (L32-62): Orchestrates all test scenarios and demonstrates debugging patterns

**Execution Flow**:
1. Arithmetic test: Multiplies predefined values (15 * 3)
2. Array processing: Sums array [10, 20, 30, 40, 50] with iteration logging
3. Recursive computation: Calculates 6th Fibonacci number
4. Object creation: Combines results into structured data
5. Final aggregation: Sums object properties for final result

**Debugging Features**:
- Extensive console.log statements throughout for execution tracing
- Multiple data types (primitives, arrays, objects) for variable inspection
- Recursive function for call stack analysis
- Mixed operations for breakpoint testing
- Return value propagation for result verification

**Dependencies**: Node.js runtime (shebang L1), native console API

**Architectural Patterns**: Simple procedural design with clear separation of concerns, designed for step-through debugging rather than production use.