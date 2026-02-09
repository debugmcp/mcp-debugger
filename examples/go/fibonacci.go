package main

import (
	"fmt"
)

// fibonacci calculates the nth Fibonacci number
func fibonacci(n int) int {
	if n <= 1 {
		return n
	}
	return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
	fmt.Println("Fibonacci Sequence Calculator")
	fmt.Println("==============================")

	// Calculate and display Fibonacci numbers
	for i := 0; i <= 10; i++ {
		result := fibonacci(i)
		fmt.Printf("fibonacci(%d) = %d\n", i, result)
	}

	// Calculate a specific Fibonacci number
	n := 15
	result := fibonacci(n)
	fmt.Printf("\nfibonacci(%d) = %d\n", n, result)
}
