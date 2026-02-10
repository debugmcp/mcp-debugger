# examples/go/fibonacci/
@generated: 2026-02-10T21:26:16Z

## Purpose
Educational demonstration module showcasing algorithmic optimization techniques through Fibonacci sequence calculation. Serves as a comparative study of three fundamental programming approaches: naive recursion, iterative optimization, and dynamic programming with memoization.

## Key Components
The directory contains a single comprehensive program (`main.go`) that implements and benchmarks three distinct Fibonacci algorithms:

- **Recursive Implementation**: Classic exponential-time approach demonstrating algorithmic inefficiency
- **Iterative Implementation**: Linear-time optimization using constant space
- **Memoized Implementation**: Dynamic programming solution combining recursion with caching

## Public API Surface
**Main Entry Point**: 
- `main()` - Orchestrates the complete demonstration, benchmarking all three implementations with n=10 and displaying performance comparisons

**Algorithm Implementations**:
- `fibonacciRecursive(int) int` - Naive recursive approach (O(2^n) time)
- `fibonacciIterative(int) int` - Optimized iterative approach (O(n) time, O(1) space)
- `fibonacciMemoized(int, map[int]int) int` - Memoized recursive approach (O(n) time with caching)

## Internal Organization
The program follows a clear educational progression:
1. **Benchmarking Phase**: Times each algorithm implementation using Go's `time` package
2. **Comparison Phase**: Displays performance results highlighting complexity differences
3. **Demonstration Phase**: Generates complete Fibonacci sequence using the efficient iterative method

## Data Flow
All implementations handle the same mathematical function but with different computational strategies:
- Input: Integer n (sequence position)
- Processing: Three distinct calculation approaches with varying time/space complexity
- Output: Fibonacci number F(n) plus performance metrics

## Important Patterns
- **Performance Measurement**: Consistent timing methodology using `time.Now()` and `time.Since()`
- **Base Case Handling**: All implementations uniformly return n for n≤1
- **Educational Progression**: Demonstrates evolution from inefficient to optimized solutions
- **Memory Management**: Memoized version requires external map initialization, showcasing trade-offs between time and space complexity

This module serves as an excellent educational resource for understanding algorithmic complexity, optimization techniques, and performance analysis in Go programming.