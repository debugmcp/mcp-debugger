# examples/go/fibonacci.go
@source-hash: 7f809679531cb9f3
@generated: 2026-02-09T18:14:50Z

## Purpose
Simple Go command-line program demonstrating recursive Fibonacci number calculation with formatted output.

## Key Components

**fibonacci function (L8-13)**
- Recursive implementation of Fibonacci sequence calculation
- Takes integer `n` as input, returns nth Fibonacci number
- Base case: returns `n` for `n <= 1` (handles 0 and 1)
- Recursive case: `fibonacci(n-1) + fibonacci(n-2)`
- **Performance Note**: Exponential time complexity O(2^n) due to redundant calculations

**main function (L15-29)**
- Entry point that demonstrates Fibonacci calculation
- Prints formatted header and sequence table
- Loop (L20-23): calculates and displays Fibonacci numbers 0-10
- Single calculation (L26-28): demonstrates specific value calculation for n=15

## Dependencies
- `fmt` package for console output formatting

## Architectural Patterns
- Pure functional approach for Fibonacci calculation
- Straightforward recursive algorithm without memoization
- Console application with formatted tabular output

## Critical Considerations
- Algorithm has exponential time complexity - inefficient for large values
- No input validation or error handling
- Hardcoded demonstration values (0-10, then 15)
- Stack overflow risk for very large input values due to deep recursion