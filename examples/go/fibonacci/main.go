package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("Fibonacci Calculator")
	
	n := 10
	
	// Test recursive implementation
	fmt.Printf("\n=== Recursive Fibonacci ===\n")
	start := time.Now()
	result := fibonacciRecursive(n)
	elapsed := time.Since(start)
	fmt.Printf("fibonacci(%d) = %d (took %v)\n", n, result, elapsed)
	
	// Test iterative implementation
	fmt.Printf("\n=== Iterative Fibonacci ===\n")
	start = time.Now()
	result = fibonacciIterative(n)
	elapsed = time.Since(start)
	fmt.Printf("fibonacci(%d) = %d (took %v)\n", n, result, elapsed)
	
	// Test memoized implementation
	fmt.Printf("\n=== Memoized Fibonacci ===\n")
	memo := make(map[int]int)
	start = time.Now()
	result = fibonacciMemoized(n, memo)
	elapsed = time.Since(start)
	fmt.Printf("fibonacci(%d) = %d (took %v)\n", n, result, elapsed)
	
	// Print sequence
	fmt.Printf("\n=== Fibonacci Sequence (0 to %d) ===\n", n)
	for i := 0; i <= n; i++ {
		fmt.Printf("F(%d) = %d\n", i, fibonacciIterative(i))
	}
}

// Recursive implementation - simple but slow for large numbers
func fibonacciRecursive(n int) int {
	if n <= 1 {
		return n
	}
	return fibonacciRecursive(n-1) + fibonacciRecursive(n-2)
}

// Iterative implementation - efficient
func fibonacciIterative(n int) int {
	if n <= 1 {
		return n
	}
	
	prev := 0
	curr := 1
	
	for i := 2; i <= n; i++ {
		next := prev + curr
		prev = curr
		curr = next
	}
	
	return curr
}

// Memoized implementation - combines recursion with caching
func fibonacciMemoized(n int, memo map[int]int) int {
	if n <= 1 {
		return n
	}
	
	// Check if already computed
	if val, exists := memo[n]; exists {
		return val
	}
	
	// Compute and store
	result := fibonacciMemoized(n-1, memo) + fibonacciMemoized(n-2, memo)
	memo[n] = result
	
	return result
}

