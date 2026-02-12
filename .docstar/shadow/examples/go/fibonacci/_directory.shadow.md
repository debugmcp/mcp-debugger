# examples/go/fibonacci/
@generated: 2026-02-11T23:47:32Z

## Purpose
Educational Go example demonstrating Fibonacci sequence computation with algorithmic complexity analysis. This module serves as a comparative study of three fundamental algorithm design patterns: naive recursion, iterative optimization, and dynamic programming with memoization.

## Key Components
The directory contains a single comprehensive example (`main.go`) that implements and benchmarks three distinct Fibonacci algorithms:

- **Recursive Implementation**: Classic exponential-time approach O(2^n) showcasing the inefficiency of naive recursion
- **Iterative Implementation**: Linear-time solution O(n) demonstrating algorithmic optimization through iteration
- **Memoized Implementation**: Dynamic programming approach achieving O(n) time complexity through caching

## Public API Surface
**Main Entry Point**: `main()` function serves as the primary demonstration driver, executing all three algorithms with performance benchmarking for n=10.

**Algorithm Functions**:
- `fibonacciRecursive(n int) int`: Exponential-time recursive implementation
- `fibonacciIterative(n int) int`: Linear-time iterative implementation  
- `fibonacciMemoized(n int, memo map[int]int) int`: Memoized recursive implementation

## Internal Organization and Data Flow
1. **Initialization**: Main function sets up timing infrastructure and test parameters
2. **Sequential Benchmarking**: Each algorithm is timed individually using `time.Now()` and `time.Since()`
3. **Performance Comparison**: Results are displayed showing execution time differences
4. **Sequence Generation**: Complete Fibonacci sequence F(0) through F(n) is generated using the efficient iterative approach

## Important Patterns and Conventions
- **Performance Measurement**: Consistent timing methodology across all implementations
- **Base Case Handling**: All algorithms handle edge cases (n≤1) by returning n
- **Memoization Pattern**: External map initialization and passing for cache management
- **Educational Structure**: Progressive complexity demonstration from naive to optimized solutions

## Dependencies
- Standard library only: `fmt` for output formatting, `time` for performance measurement
- No external dependencies, making it suitable for educational environments

This example effectively demonstrates fundamental computer science concepts including algorithm analysis, time complexity, space complexity, and optimization techniques through practical implementation.