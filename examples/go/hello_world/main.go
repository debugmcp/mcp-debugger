package main

import (
	"fmt"
)

func main() {
	// Simple variable declarations
	name := "MCP Debugger"
	version := "0.17.0"
	
	fmt.Printf("Welcome to %s v%s\n", name, version)
	
	// Numeric operations
	x := 10
	y := 20
	sum := add(x, y)
	fmt.Printf("Sum of %d and %d is %d\n", x, y, sum)
	
	// String operations
	greeting := greet("Gopher")
	fmt.Println(greeting)
	
	// Collections
	numbers := []int{1, 2, 3, 4, 5}
	fmt.Printf("Numbers: %v\n", numbers)
	
	// Map example
	colors := map[string]string{
		"red":   "#FF0000",
		"green": "#00FF00",
		"blue":  "#0000FF",
	}
	
	for color, hex := range colors {
		fmt.Printf("Color %s has hex code %s\n", color, hex)
	}
	
	// Conditional logic
	if sum > 25 {
		fmt.Println("Sum is greater than 25")
	} else {
		fmt.Println("Sum is 25 or less")
	}
	
	// Loop example
	for i := 0; i < 3; i++ {
		fmt.Printf("Loop iteration: %d\n", i)
	}
	
	fmt.Println("Debugging complete!")
}

func add(a, b int) int {
	result := a + b
	return result
}

func greet(name string) string {
	return fmt.Sprintf("Hello, %s! Welcome to Go debugging.", name)
}

