# examples/javascript/typescript_test.ts
@source-hash: 65709a1a6276d582
@generated: 2026-02-09T18:14:56Z

## Purpose
TypeScript debugging test file designed to exercise MCP debugger capabilities across various language features including source maps, breakpoints, variable inspection, and stack traces.

## Key Components

### Core Types & Interfaces
- **Person interface (L7-11)**: Basic test type with optional email field for type inspection testing
- **TodoStatus type (L60)**: Union type for status values (`'pending' | 'completed' | 'cancelled'`)
- **Todo interface (L62-68)**: Complex data structure with Record metadata for advanced variable inspection

### Main Classes
- **Calculator class (L14-32)**: Test harness for method debugging
  - `add()` method (L17-21): Addition with history tracking, breakpoint at L18
  - `multiply()` method (L23-27): Multiplication with history tracking, breakpoint at L24
  - `getHistory()` method (L29-31): Returns readonly view of operation history
  - Private `history` array for state inspection testing

### Core Functions
- **swap<T> function (L35-41)**: Generic function for testing type parameter handling, breakpoint at L37
- **fetchData() async function (L44-57)**: Promise-based operation for async debugging, breakpoint at L50
- **throwTestError() function (L138-140)**: Error generator for stack trace testing
- **main() function (L71-136)**: Test orchestrator executing all debugging scenarios

### Debugging Test Points
The file contains 7 strategically placed breakpoint locations:
1. L18: Calculator.add() result calculation
2. L24: Calculator.multiply() result calculation  
3. L37: Generic function variable assignment
4. L50: Async function object construction
5. L77: Method call on class instance
6. L122: Complex data structure iteration
7. L132: Error handling catch block

### Test Scenarios
1. **Class debugging**: Instance creation, method calls, private field inspection
2. **Generic type handling**: Template function with multiple type instantiations
3. **Async/await debugging**: Promise resolution and async stack traces
4. **Complex data structures**: Nested objects, arrays, Record types, union types
5. **Error handling**: Exception throwing and stack trace inspection

### Architectural Patterns
- Comprehensive debugger feature coverage in a single executable file
- Strategic breakpoint placement for step-through debugging
- Mixed sync/async operations for concurrent debugging scenarios
- Graduated complexity from simple arithmetic to complex nested structures