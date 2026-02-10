# examples/javascript/typescript_test.js
@source-hash: 26c8d90a93924bff
@generated: 2026-02-09T18:15:01Z

## Purpose
TypeScript debugging test suite compiled to JavaScript for testing MCP debugger capabilities including source map resolution, breakpoints, variable inspection, stepping, and async debugging.

## Key Components

### Runtime Support (L5-40)
- `__awaiter` (L5-13): TypeScript-generated async/await runtime helper function
- `__generator` (L14-40): TypeScript-generated generator runtime helper with complex state machine for async operations

### Calculator Class (L42-60)
- Constructor (L43-45): Initializes empty `history` array
- `add(a, b)` (L46-50): Addition with result logging to history, **Breakpoint 1 at L47**
- `multiply(a, b)` (L51-55): Multiplication with result logging, **Breakpoint 2 at L52** 
- `getHistory()` (L56-58): Returns calculation history array

### Generic Functions
- `swap<T>(a, b)` (L62-68): Generic value swapping with console logging, **Breakpoint 3 at L64**

### Async Operations
- `fetchData(id)` (L70-91): Async function using generator pattern to simulate API fetch with 100ms delay, returns person object
- Uses `__awaiter` and `__generator` for async/await transpilation

### Main Test Orchestration (L93-166)
- `main()` (L93-166): Comprehensive test suite covering:
  - Class instantiation and method calls (L101-106)
  - Generic function testing with numbers and strings (L108-112)  
  - Async operations with sequential awaits (L114-121)
  - Complex nested data structures with todos array (L123-153)
  - Error handling and stack traces (L155-160)
- **Breakpoint 6 at L148** (for loop iteration)
- **Breakpoint 7 at L159** (error catch block)

### Utility Functions
- `throwTestError()` (L167-169): Throws test error for stack trace inspection
- Entry point (L171): Executes main with error handling

## Architecture Notes
- Compiled TypeScript with source map reference (L172)
- Uses TypeScript runtime helpers for async/generator support
- Breakpoint comments reference original TypeScript line numbers
- Designed for comprehensive debugger feature testing including stepping, variable inspection, async debugging, and error handling

## Dependencies
- Built-in JavaScript Promise API
- Console logging for output verification
- setTimeout for async simulation