# examples\go\fibonacci/
@generated: 2026-02-12T21:00:53Z

## Purpose
Educational demonstration module showcasing algorithmic optimization through Fibonacci number calculation. Serves as a performance comparison study illustrating how different implementation approaches affect computational complexity and runtime efficiency.

## Key Components
The directory contains a single comprehensive demonstration program (`main.go`) that implements and compares three distinct Fibonacci calculation algorithms:

- **Recursive Implementation**: Classic textbook approach with exponential O(2^n) complexity
- **Iterative Implementation**: Optimized linear O(n) approach with constant space usage  
- **Memoized Implementation**: Dynamic programming solution combining recursion with caching for O(n) performance

## Public API Surface
**Main Entry Point**: `main()` function orchestrates the complete demonstration by:
- Benchmarking all three implementations with timing measurements
- Displaying performance comparison results
- Generating and printing the complete Fibonacci sequence

**Algorithm Implementations**: Three public functions provide different computational approaches:
- `fibonacciRecursive(n int) int` - Simple recursive solution
- `fibonacciIterative(n int) int` - Memory-efficient iterative solution
- `fibonacciMemoized(n int, memo map[int]int) int` - Cached recursive solution

## Internal Organization
The program follows a clear educational progression:
1. **Performance Benchmarking**: Uses Go's `time` package to measure and compare execution times
2. **Algorithm Demonstration**: Each implementation handles the same mathematical problem with different complexity characteristics
3. **Results Presentation**: Formatted output shows both performance metrics and actual sequence generation

## Data Flow
1. Main function initializes with target value (n=10)
2. Sequential execution of each algorithm with timing measurements
3. Performance results displayed with execution time comparisons
4. Complete Fibonacci sequence generated using the most efficient (iterative) implementation
5. All results formatted and printed to console

## Important Patterns
- **Consistent Interface**: All algorithms accept integer input and return integer Fibonacci values
- **Base Case Handling**: Universal handling of edge cases (n ≤ 1 returns n)
- **Performance Measurement**: Standardized timing methodology using `time.Now()` and `time.Since()`
- **Educational Progression**: Demonstrates algorithmic evolution from naive to optimized solutions
- **Practical Application**: Shows real-world impact of algorithm choice on performance

This module serves as a practical introduction to algorithmic complexity analysis and optimization techniques in Go.