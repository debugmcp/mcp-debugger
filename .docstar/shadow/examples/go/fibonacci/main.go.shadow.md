# examples/go/fibonacci/main.go
@source-hash: 7b83cd29c5a3c61c
@generated: 2026-02-09T18:14:28Z

## Primary Purpose
Educational demonstration program comparing three Fibonacci sequence implementations with performance benchmarking. Serves as a Go programming example showcasing algorithmic complexity differences.

## Key Functions

**main() (L8-40)**: Entry point that benchmarks three Fibonacci implementations for n=10, measures execution time, and prints the complete sequence 0-10.

**fibonacciRecursive(n int) int (L43-48)**: Naive recursive implementation with O(2^n) time complexity. Returns n for base cases (n ≤ 1), otherwise computes F(n-1) + F(n-2).

**fibonacciIterative(n int) int (L51-66)**: Efficient iterative implementation with O(n) time and O(1) space complexity. Uses two variables to track previous values and iterates forward.

**fibonacciMemoized(n int, memo map[int]int) int (L69-84)**: Recursive implementation with memoization cache to achieve O(n) time complexity. Checks memo map before computation and stores results.

## Dependencies
- `fmt`: Standard output formatting and printing
- `time`: Performance measurement with `time.Now()` and `time.Since()`

## Architecture & Patterns
- Performance comparison pattern: Each implementation is timed using identical measurement approach
- Memoization pattern: External cache map passed by reference to maintain state across recursive calls
- Educational structure: Clear separation of algorithms with descriptive output sections

## Key Implementation Details
- Fixed test value n=10 for consistent benchmarking
- Memo map initialized in main() and passed to memoized function
- Sequence generation (L37-39) uses iterative method for efficiency
- All functions handle base cases (n ≤ 1) identically

## Critical Invariants
- All three implementations produce mathematically equivalent results
- Memoization requires external map initialization for proper function
- Base case handling is consistent across all implementations