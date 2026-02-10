# examples/go/fibonacci.go
@source-hash: 7f809679531cb9f3
@generated: 2026-02-10T00:41:35Z

## Purpose
Simple Go example program demonstrating recursive Fibonacci sequence calculation with console output.

## Key Components

### Functions
- **fibonacci(n int) int (L8-13)**: Core recursive function calculating nth Fibonacci number using classic base cases (n≤1 returns n) and recursive relation F(n) = F(n-1) + F(n-2)
- **main() (L15-29)**: Entry point that demonstrates fibonacci function by printing sequence for numbers 0-10 and calculating F(15)

### Dependencies
- **fmt package (L4)**: Used for console output formatting via Println and Printf

## Implementation Details

### Algorithm Characteristics
- Uses naive recursive approach with exponential time complexity O(2^n)
- No memoization or optimization - suitable for educational purposes only
- Base cases handle n=0 (returns 0) and n=1 (returns 1) correctly

### Output Pattern
- Prints formatted header and sequence table for F(0) through F(10)
- Demonstrates specific calculation for F(15) = 610
- Uses consistent formatting with Printf for numbered results

### Performance Notes
- Inefficient for large n values due to repeated subproblem calculation
- Suitable for small demonstrations (n≤20 reasonable on modern hardware)
- No error handling for negative inputs