# examples/go/fibonacci/main.go
@source-hash: 7b83cd29c5a3c61c
@generated: 2026-02-10T00:41:21Z

## Purpose
Educational demonstration program comparing three Fibonacci number calculation algorithms with performance benchmarking. Showcases algorithmic complexity differences through recursive, iterative, and memoized implementations.

## Key Functions

**main() (L8-40)**: Entry point that benchmarks and compares three Fibonacci implementations using n=10. Measures execution time for each approach and displays a complete sequence from F(0) to F(n).

**fibonacciRecursive() (L43-48)**: Classic recursive implementation with exponential time complexity O(2^n). Returns base cases n for n≤1, otherwise recursively computes F(n-1) + F(n-2). Inefficient for large numbers due to redundant calculations.

**fibonacciIterative() (L51-66)**: Optimized iterative implementation with linear time complexity O(n) and constant space O(1). Uses two variables (prev, curr) to track previous values and iteratively builds up to the target.

**fibonacciMemoized() (L69-84)**: Recursive implementation enhanced with dynamic programming using a memo map. Achieves O(n) time complexity by caching previously computed values, eliminating redundant recursive calls.

## Dependencies
- `fmt`: Console output formatting and printing
- `time`: Performance measurement with time.Now() and time.Since()

## Architecture Pattern
Performance comparison study demonstrating algorithmic optimization progression:
1. Naive recursion (exponential complexity)
2. Iterative optimization (linear complexity) 
3. Memoization technique (linear complexity with caching)

## Key Invariants
- All implementations handle base cases n≤1 by returning n
- Memoized version requires external map initialization and passing
- Performance measurements use consistent timing methodology
- Sequence generation relies on iterative implementation for efficiency