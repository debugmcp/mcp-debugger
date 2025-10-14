#!/usr/bin/env node
/**
 * Comprehensive JavaScript test script for MCP debugger testing
 */

function fibonacci(n) {
    // Calculate fibonacci number recursively
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

function calculateSum(numbers) {
    // Calculate sum of numbers
    let total = 0;
    for (const num of numbers) {
        total += num;
    }
    return total;
}

function factorial(n) {
    // Calculate factorial
    if (n <= 1) {
        return 1;
    }
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

function main() {
    // Main function to test various debugging scenarios
    
    // Test 1: Simple variables
    const x = 10;
    const y = 20;
    const z = x + y;
    console.log(`Sum: ${z}`);
    
    // Test 2: Array operations
    const numbers = [1, 2, 3, 4, 5];
    const sumResult = calculateSum(numbers);
    console.log(`Sum of array: ${sumResult}`);
    
    // Test 3: Recursive function
    const fib5 = fibonacci(5);
    console.log(`Fibonacci(5): ${fib5}`);
    
    // Test 4: Loop with calculation
    const fact5 = factorial(5);
    console.log(`Factorial(5): ${fact5}`);
    
    // Test 5: Object
    const person = {
        name: "Alice",
        age: 30,
        city: "New York"
    };
    console.log(`Person: ${person.name}, ${person.age}`);
    
    // Test 6: Conditional logic
    if (z > 25) {
        console.log("Z is greater than 25");
    } else {
        console.log("Z is 25 or less");
    }
    
    // Test 7: Arrow function
    const square = (n) => n * n;
    const squared = square(7);
    console.log(`Square of 7: ${squared}`);
    
    console.log("Test complete!");
}

// Run the main function
main();
