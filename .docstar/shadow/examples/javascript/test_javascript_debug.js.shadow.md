# examples/javascript/test_javascript_debug.js
@source-hash: cc36b9c79f9ab95c
@generated: 2026-02-09T18:14:54Z

## Primary Purpose
JavaScript test script designed for debugging practice and demonstration. Provides a controlled environment with multiple function types and data operations to test debugging tools and techniques.

## Key Functions

### `factorial(n)` (L6-12)
Recursive factorial implementation with base case handling. Single parameter validation at `n <= 1`, returns 1 for base case or recursive multiplication. Standard mathematical implementation with clear recursion pattern.

### `sumList(numbers)` (L14-21)  
Array summation using for-of loop iteration. Accumulates total through sequential addition of array elements. Handles any iterable numeric collection.

### `processData(data)` (L23-31)
Data transformation function that doubles each input element. Uses for-of iteration to create new array with transformed values. Simple mapping operation without side effects.

### `main()` (L33-58)
Primary orchestration function demonstrating various computational patterns:
- Local variable operations (L35-37): basic arithmetic
- Factorial computation (L40-41): recursive function call  
- Array processing (L44-46): iteration and summation
- Data transformation (L49-51): mapping operations
- Final computation (L54-55): combining results

## Execution Flow
Script entry point at L61 calls `main()` and logs final result. All functions are pure with clear input/output relationships, making them suitable for step-through debugging.

## Dependencies
- Node.js runtime (shebang at L1)
- Console API for output logging
- No external modules or complex dependencies

## Architectural Notes
- Functions follow single responsibility principle
- Clear separation between computation and I/O operations
- Predictable execution flow with deterministic outputs
- Designed for educational debugging scenarios with multiple breakpoint opportunities